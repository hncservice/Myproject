import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminVendorsPage from './AdminVendorsPage';
import AdminUsersPage from './AdminUsersPage';
import AdminOperationsPage from './AdminOperationsPage';
import AdminPrizeReviewsPage from './AdminPrizeReviewsPage';
import { reportCsv } from '../reportCsv';
const api = vi.hoisted(() => Object.fromEntries(['getVendors','createVendor','updateVendor','adminListUsers','adminCreateUser','adminUpdateUser','adminDeleteUser','getAdminOperations','listPrizeReviews','getPrizeReview','reviewPrize'].map(n => [n,vi.fn()])));
vi.mock('../api/adminApi', () => api);
const vendor = { _id: 'synthetic-vendor', name: 'Synthetic Vendor', email: 'vendor@example.com', isActive: true };
beforeEach(() => {
  vi.resetAllMocks();
  for(const name of ['fetch','XMLHttpRequest','WebSocket']) vi.stubGlobal(name,()=>{throw new Error('NETWORK_FORBIDDEN');});
  api.getVendors.mockResolvedValue({data:[vendor]}); api.updateVendor.mockResolvedValue({data:{}}); api.createVendor.mockResolvedValue({data:{}});
  api.adminListUsers.mockResolvedValue({data:{items:[{_id:'synthetic-user',name:'Synthetic User',email:'user@example.com',phone:'12345678',emailVerified:true}],total:1,pages:1}});
  api.adminUpdateUser.mockResolvedValue({data:{}}); api.adminCreateUser.mockResolvedValue({data:{}});
  api.getAdminOperations.mockResolvedValue({data:{items:[],total:0,page:1,pages:1}});
  api.listPrizeReviews.mockResolvedValue({data:{items:[{id:'review',gameId:'monkey',gameSessionId:'synthetic-session',status:'pending_review'}],total:1}});
  api.getPrizeReview.mockResolvedValue({data:{review:{gameSessionId:'synthetic-session',status:'pending_review',riskReasons:['synthetic integrity finding']},gameplay:{score:7}}});
  api.reviewPrize.mockResolvedValue({data:{prizeAllocated:false}});
});
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('edits vendor activation with explicit revocation through existing contract',async()=>{
  render(<AdminVendorsPage/>); fireEvent.click(await screen.findByRole('button',{name:'Edit'}));
  fireEvent.click(screen.getByLabelText('Vendor active')); fireEvent.click(screen.getByLabelText('Revoke existing sessions'));
  fireEvent.click(screen.getByRole('button',{name:'Save Changes'}));
  await waitFor(()=>expect(api.updateVendor).toHaveBeenCalledExactlyOnceWith('synthetic-vendor',{name:'Synthetic Vendor',email:'vendor@example.com',isActive:false,revokeSessions:true}));
});
it('creates vendors without activation or privilege fields',async()=>{
  const {container}=render(<AdminVendorsPage/>); await screen.findByText(/Synthetic Vendor/);
  for(const [label,value] of [['Name','New Vendor'],['Email','new@example.com'],[/^Password/,'password']]) fireEvent.change(screen.getByLabelText(label),{target:{value}});
  fireEvent.submit(container.querySelector('form')); await waitFor(()=>expect(api.createVendor).toHaveBeenCalledWith({name:'New Vendor',email:'new@example.com',password:'password'}));
});
it('vendor update failure remains visible without reporting success',async()=>{
  api.updateVendor.mockRejectedValue({response:{data:{message:'Vendor session revoked'}}}); render(<AdminVendorsPage/>);
  fireEvent.click(await screen.findByRole('button',{name:'Edit'})); fireEvent.click(screen.getByRole('button',{name:'Save Changes'})); await screen.findByText('Vendor session revoked');
});
it('customer edit submits only supported identity fields',async()=>{
  render(<AdminUsersPage/>); fireEvent.click(await screen.findByRole('button',{name:'Edit'}));
  fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Renamed User'}});
  fireEvent.click(screen.getByRole('button',{name:/Save/}));
  await waitFor(()=>expect(api.adminUpdateUser).toHaveBeenCalledExactlyOnceWith('synthetic-user',{name:'Renamed User',phone:'12345678'}));
  expect(screen.queryByRole('button',{name:'Reset Game'})).toBeNull();
});
it('unsupported customer privilege controls are read-only',async()=>{
  render(<AdminUsersPage/>); fireEvent.click(await screen.findByRole('button',{name:'Edit'}));
  for(const input of screen.getAllByRole('checkbox')) expect(input.disabled).toBe(true);
  expect(screen.getByLabelText('Monkey Attempts').disabled).toBe(true);
  expect(screen.getByPlaceholderText('Leave blank to keep').disabled).toBe(true);
});
it('operations exposes empty state and bounded search sort pagination',async()=>{
  render(<AdminOperationsPage/>); await screen.findByText('No records found.');
  fireEvent.change(screen.getByLabelText('Search'),{target:{value:'monkey'}});
  fireEvent.change(screen.getByLabelText('Sort'),{target:{value:'oldest'}}); fireEvent.click(screen.getByRole('button',{name:'Next'}));
  await waitFor(()=>expect(api.getAdminOperations).toHaveBeenLastCalledWith('sessions',{page:2,limit:20,q:'monkey',sort:'oldest'}));
});
it('operations replacement hides old rows while new request is pending',async()=>{
  api.getAdminOperations.mockResolvedValueOnce({data:{items:[{id:'old-session'}],total:1,page:1,pages:1}}).mockReturnValue(new Promise(()=>{}));
  render(<AdminOperationsPage/>); await screen.findByText('old-session'); fireEvent.change(screen.getByLabelText('Report'),{target:{value:'audit-logs'}});
  expect(screen.queryByText('old-session')).toBeNull(); expect(screen.getByRole('status').textContent).toContain('Loading');
});
it('configuration is explicitly source-managed and read only',async()=>{
  api.getAdminOperations.mockResolvedValue({data:{readOnly:true,campaign:{campaignId:'synthetic'}}}); render(<AdminOperationsPage/>);
  fireEvent.change(screen.getByLabelText('Report'),{target:{value:'configuration'}}); await screen.findByText('Source-managed configuration');
  expect(screen.queryByRole('button',{name:/save/i})).toBeNull();
});
it('operations errors do not expose provider details',async()=>{
  api.getAdminOperations.mockRejectedValue(new Error('secret')); render(<AdminOperationsPage/>); await screen.findByRole('alert'); expect(screen.queryByText('secret')).toBeNull();
});
it('review selection displays independent findings and does not auto approve',async()=>{
  render(<AdminPrizeReviewsPage/>); fireEvent.click(await screen.findByRole('button',{name:'monkey: synthetic-session'}));
  await screen.findByText('synthetic integrity finding'); expect(screen.getByRole('heading',{name:'Integrity V2'})).toBeTruthy(); expect(screen.getByRole('heading',{name:'Behavioral Signals V1'})).toBeTruthy(); expect(api.reviewPrize).not.toHaveBeenCalled();
});
it('manual review uses existing review action and clears selected evidence',async()=>{
  render(<AdminPrizeReviewsPage/>); fireEvent.click(await screen.findByRole('button',{name:'monkey: synthetic-session'})); fireEvent.click(await screen.findByRole('button',{name:'Approve review'}));
  await waitFor(()=>expect(api.reviewPrize).toHaveBeenCalledExactlyOnceWith('review','approve')); await waitFor(()=>expect(screen.queryByText('synthetic integrity finding')).toBeNull());
});
it('review status change clears stale details immediately',async()=>{
  render(<AdminPrizeReviewsPage/>); fireEvent.click(await screen.findByRole('button',{name:'monkey: synthetic-session'})); await screen.findByText('synthetic integrity finding');
  fireEvent.change(screen.getByLabelText('Review status'),{target:{value:'approved'}}); expect(screen.queryByText('synthetic integrity finding')).toBeNull();
});
it('review error is safe and allows explicit retry without allocating',async()=>{
  api.reviewPrize.mockRejectedValue(new Error('internal secret')); render(<AdminPrizeReviewsPage/>); fireEvent.click(await screen.findByRole('button',{name:'monkey: synthetic-session'})); fireEvent.click(await screen.findByRole('button',{name:'Reject review'}));
  await screen.findByRole('alert'); expect(screen.queryByText('internal secret')).toBeNull(); expect(screen.queryByRole('button',{name:/allocate/i})).toBeNull();
});
it('report strings remain ordinary React text',async()=>{
  api.getAdminOperations.mockResolvedValue({data:{items:[{id:'<img src=x onerror=alert(1)>'}],total:1,page:1,pages:1}});
  const {container}=render(<AdminOperationsPage/>); await screen.findByText('<img src=x onerror=alert(1)>'); expect(container.querySelector('img')).toBeNull();
});
it('vendor search filter sort and pagination use bounded parameters',async()=>{
  api.getVendors.mockResolvedValue({data:{items:[vendor],pages:2}});render(<AdminVendorsPage/>);await screen.findByText(/Synthetic Vendor/);
  fireEvent.change(screen.getByLabelText('Search vendors'),{target:{value:'Synthetic'}});
  fireEvent.change(screen.getByLabelText('Account status'),{target:{value:'false'}});
  fireEvent.change(screen.getByLabelText('Vendor sort'),{target:{value:'name'}});
  await waitFor(()=>expect(screen.getByRole('button',{name:'Next vendors'}).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Next vendors'}));
  await waitFor(()=>expect(api.getVendors).toHaveBeenLastCalledWith({page:2,limit:20,q:'Synthetic',active:'false',sort:'name'}));
});
it('CSV handles formulas quotes multiline values and export bounds',()=>{
  const csv=reportCsv([{id:'=HYPERLINK()',text:'a,"b"\nc'}]);
  expect(csv).toBe('"id","text"\r\n"\'=HYPERLINK()","a,""b""\nc"');
  expect(()=>reportCsv(Array.from({length:51},()=>({id:'x'})))).toThrow('Invalid export page');expect(reportCsv([])).toBe('');
});
it('CSV download releases object URL without real file delivery',async()=>{
  const create=vi.fn(()=> 'blob:synthetic'), revoke=vi.fn();vi.stubGlobal('URL',Object.assign(class extends URL {},{createObjectURL:create,revokeObjectURL:revoke}));
  const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
  api.getAdminOperations.mockResolvedValue({data:{items:[{id:'synthetic'}],total:1,page:1,pages:1}});render(<AdminOperationsPage/>);await screen.findByText('synthetic');fireEvent.click(screen.getByRole('button',{name:'Export page CSV'}));
  expect(create).toHaveBeenCalledTimes(1);expect(click).toHaveBeenCalledTimes(1);expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:synthetic');
});
