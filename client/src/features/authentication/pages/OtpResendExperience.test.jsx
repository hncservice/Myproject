import React from 'react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import VerifyOtpPage from './VerifyOtpPage';
const api=vi.hoisted(()=>({verifyOtp:vi.fn(),resendUserOtp:vi.fn()}));
vi.mock('../api/authApi',()=>api);
vi.mock('../context/AuthContext',()=>({useAuth:()=>({login:vi.fn()})}));
function Change(){const navigate=useNavigate();return <button onClick={()=>navigate('/verify-otp',{state:{email:'replacement@example.com'}})}>Change identity</button>;}
function mount(){return render(<MemoryRouter initialEntries={[{pathname:'/verify-otp',state:{email:'synthetic@example.com'}}]}><Change/><VerifyOtpPage/></MemoryRouter>);}
beforeEach(()=>{vi.resetAllMocks();api.resendUserOtp.mockResolvedValue({data:{}});for(const name of ['fetch','XMLHttpRequest','WebSocket'])vi.stubGlobal(name,()=>{throw new Error('NETWORK_FORBIDDEN');});});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('successful resend shows quiet countdown and blocks repeated calls',async()=>{mount();vi.useFakeTimers();await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Resend OTP'}));});expect(screen.getByRole('timer').textContent).toContain('60s');expect(screen.getByRole('timer').getAttribute('aria-live')).toBe('off');fireEvent.click(screen.getByRole('button',{name:'Resend OTP'}));expect(api.resendUserOtp).toHaveBeenCalledTimes(1);act(()=>vi.advanceTimersByTime(1000));expect(screen.getByRole('timer').textContent).toContain('59s');});
it('countdown releases resend and cleans up timers on unmount',async()=>{const view=mount();vi.useFakeTimers();await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Resend OTP'}));});for(let i=0;i<60;i++)act(()=>vi.advanceTimersByTime(1000));expect(screen.queryByRole('timer')).toBeNull();expect(screen.getByRole('button',{name:'Resend OTP'}).disabled).toBe(false);view.unmount();expect(vi.getTimerCount()).toBe(0);});
it('changing identity resets its resend feedback and cooldown',async()=>{mount();await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Resend OTP'}));});expect(screen.getByRole('timer')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Change identity'}));expect(screen.queryByRole('timer')).toBeNull();expect(screen.getByRole('button',{name:'Resend OTP'}).disabled).toBe(false);expect(screen.getByText('replacement@example.com')).toBeTruthy();});
it('expired OTP message preserves typed digits for correction',async()=>{api.verifyOtp.mockRejectedValue({response:{status:400,data:{message:'OTP has expired. Request a new code.'}}});mount();for(let i=1;i<=6;i++)fireEvent.change(screen.getByLabelText('OTP digit '+i),{target:{value:String(i)}});fireEvent.click(screen.getByRole('button',{name:'Verify OTP'}));expect((await screen.findByRole('alert')).textContent).toContain('expired');expect(screen.getByLabelText('OTP digit 1').value).toBe('1');expect(api.resendUserOtp).not.toHaveBeenCalled();});
