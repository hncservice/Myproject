'use strict';
const Joi = require('joi');
const Campaign = require('../models/CampaignDefinition');
const GameSession = require('../../games/models/GameSession');
const Audit = require('../../administration/models/AdminAuditLog');
const registry = require('../../games/registry/gameRegistry');
const { validId } = require('../services/campaignPolicy');
const { saveCampaign, publicDefinition } = require('../services/campaignAdministrationService');
const querySchema = Joi.object({ page: Joi.number().integer().min(1).max(100000).default(1), limit: Joi.number().integer().min(1).max(50).default(20), q: Joi.string().trim().max(100).allow('').default(''), enabled: Joi.string().valid('all','true','false').default('all') }).unknown(false);
const errorResponse = (res, e) => res.status(e.status || 500).json({ code: e.status ? e.code : 'CAMPAIGN_OPERATION_FAILED', message: e.status ? e.code : 'Unable to complete campaign operation' });
exports.list = async (req,res) => {
  const {error,value} = querySchema.validate(req.query || {});
  if(error) return res.status(400).json({code:'INVALID_CAMPAIGN_QUERY',message:'Invalid campaign search'});
  try {
    const filter = {};
    if(value.enabled !== 'all') filter.enabled = value.enabled === 'true';
    if(value.q) filter.name = {$regex:value.q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'};
    const [rows,total] = await Promise.all([Campaign.find(filter).sort({updatedAt:-1,_id:-1}).skip((value.page-1)*value.limit).limit(value.limit).lean(),Campaign.countDocuments(filter)]);
    res.set('Cache-Control','no-store');return res.json({items:rows.map(publicDefinition),total,page:value.page,pages:Math.max(1,Math.ceil(total/value.limit)),games:registry.discover(),participationActive:false});
  } catch(e) {return errorResponse(res,e);}
};
const mutationSchema = Joi.object({definition:Joi.object().required(),expectedRevision:Joi.number().integer().min(0).strict().required(),requestId:Joi.string().required()}).unknown(false).required();
function mutate(creating) {return async(req,res)=>{
  const {error,value} = mutationSchema.validate(req.body,{convert:false});
  if(error || (!creating && (!validId(req.params.campaignId) || req.params.campaignId !== value.definition.campaignId))) return res.status(400).json({code:'INVALID_CAMPAIGN_REQUEST',message:'Invalid campaign request'});
  try {const result = await saveCampaign({...value,creating,adminId:req.admin?._id,adminTokenVersion:req.adminTokenVersion});res.set('Cache-Control','no-store');return res.status(creating && !result.repeated ? 201 : 200).json(result);}catch(e){return errorResponse(res,e);}
};}
exports.create = mutate(true);exports.update = mutate(false);
exports.activity = async(req,res)=>{
  if(!validId(req.params.campaignId) || Object.keys(req.query || {}).length) return res.status(400).json({code:'INVALID_CAMPAIGN_REQUEST',message:'Invalid activity request'});
  try {
    const campaign = await Campaign.findOne({campaignId:req.params.campaignId}).lean();
    if(!campaign) return res.status(404).json({code:'CAMPAIGN_NOT_FOUND',message:'Campaign not found'});
    const [sessions,completed,audits] = await Promise.all([GameSession.countDocuments({campaignId:campaign.campaignId}),GameSession.countDocuments({campaignId:campaign.campaignId,status:'completed'}),Audit.find({targetType:'CampaignDefinition',targetId:campaign._id}).select('adminId action createdAt details.revision details.previousRevision').sort({createdAt:-1,_id:-1}).limit(20).lean()]);
    res.set('Cache-Control','no-store');return res.json({campaignId:campaign.campaignId,sessions,completed,participationActive:false,auditHistory:audits.map(a=>({id:String(a._id),adminId:String(a.adminId),action:a.action,createdAt:a.createdAt,revision:a.details?.revision,previousRevision:a.details?.previousRevision}))});
  } catch(e) {return errorResponse(res,e);}
};
