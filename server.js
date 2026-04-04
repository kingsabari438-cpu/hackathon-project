const express  = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const cors     = require('cors');
require('dotenv').config();

const { Farmer, Crop, Disease, Market, Weather } = require('./models');

const app  = express();
const PORT = process.env.PORT || 5000;

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// CONNECT MONGODB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅  MongoDB Connected!'))
  .catch(err => console.log('❌  MongoDB Error:', err.message));

// AUTH MIDDLEWARE
function auth(req, res, next){
  const token = req.headers['authorization']?.split(' ')[1];
  if(!token) return res.status(401).json({message:'No token.'});
  try { req.farmer = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({message:'Invalid token.'}); }
}

// ── TEST ROUTE ──────────────────────────────────────────────
app.get('/', (req, res) => res.json({
  message:'🌾 AgroSense AI Backend is running!',
  routes:{
    auth:   ['POST /api/auth/register','POST /api/auth/login','GET /api/auth/profile'],
    crop:   ['POST /api/crop/save','GET /api/crop/history'],
    disease:['POST /api/disease/save','GET /api/disease/history'],
    market: ['GET /api/market/prices','POST /api/market/update'],
    weather:['POST /api/weather/save','GET /api/weather/:city']
  }
}));

// ── AUTH ROUTES ─────────────────────────────────────────────
app.post('/api/auth/register', async (req,res) => {
  try {
    const {name,email,phone,password,language} = req.body;
    if(!name||!email||!password) return res.status(400).json({message:'Name, email and password required.'});
    if(await Farmer.findOne({email})) return res.status(400).json({message:'Email already registered.'});
    const hashed = await bcrypt.hash(password, 10);
    const farmer = await new Farmer({name,email,phone,password:hashed,language:language||'en'}).save();
    const token  = jwt.sign({id:farmer._id,name:farmer.name,email:farmer.email}, process.env.JWT_SECRET, {expiresIn:'7d'});
    res.status(201).json({message:'Registered!', token, farmer:{id:farmer._id,name:farmer.name,email:farmer.email,language:farmer.language}});
  } catch(err){ res.status(500).json({message:'Server error.',error:err.message}); }
});

app.post('/api/auth/login', async (req,res) => {
  try {
    const {email,password} = req.body;
    if(!email||!password) return res.status(400).json({message:'Email and password required.'});
    const farmer = await Farmer.findOne({email});
    if(!farmer||!(await bcrypt.compare(password,farmer.password)))
      return res.status(400).json({message:'Invalid email or password.'});
    const token = jwt.sign({id:farmer._id,name:farmer.name,email:farmer.email}, process.env.JWT_SECRET, {expiresIn:'7d'});
    res.json({message:'Login successful!', token, farmer:{id:farmer._id,name:farmer.name,email:farmer.email,language:farmer.language}});
  } catch(err){ res.status(500).json({message:'Server error.',error:err.message}); }
});

app.get('/api/auth/profile', auth, async (req,res) => {
  try { res.json(await Farmer.findById(req.farmer.id).select('-password')); }
  catch { res.status(500).json({message:'Server error.'}); }
});

app.put('/api/auth/language', auth, async (req,res) => {
  try { await Farmer.findByIdAndUpdate(req.farmer.id,{language:req.body.language}); res.json({message:'Language updated!'}); }
  catch { res.status(500).json({message:'Server error.'}); }
});

// ── CROP ROUTES ─────────────────────────────────────────────
app.post('/api/crop/save', auth, async (req,res) => {
  try {
    const crop = await new Crop({farmerId:req.farmer.id,...req.body}).save();
    res.status(201).json({message:'Crop saved!', crop});
  } catch(err){ res.status(500).json({message:'Server error.',error:err.message}); }
});

app.get('/api/crop/history', auth, async (req,res) => {
  try { res.json(await Crop.find({farmerId:req.farmer.id}).sort({createdAt:-1}).limit(20)); }
  catch { res.status(500).json({message:'Server error.'}); }
});

// ── DISEASE ROUTES ──────────────────────────────────────────
app.post('/api/disease/save', auth, async (req,res) => {
  try {
    const disease = await new Disease({farmerId:req.farmer.id,...req.body}).save();
    res.status(201).json({message:'Disease detection saved!', disease});
  } catch(err){ res.status(500).json({message:'Server error.',error:err.message}); }
});

app.get('/api/disease/history', auth, async (req,res) => {
  try { res.json(await Disease.find({farmerId:req.farmer.id}).sort({createdAt:-1}).limit(20)); }
  catch { res.status(500).json({message:'Server error.'}); }
});

// ── MARKET ROUTES ───────────────────────────────────────────
app.get('/api/market/prices', async (req,res) => {
  try { res.json(await Market.find().sort({commodity:1})); }
  catch { res.status(500).json({message:'Server error.'}); }
});

app.post('/api/market/update', async (req,res) => {
  try {
    for(const p of req.body.prices||[]){
      await Market.findOneAndUpdate({commodity:p.commodity},{...p,updatedAt:new Date()},{upsert:true,new:true});
    }
    res.json({message:'Prices updated!'});
  } catch(err){ res.status(500).json({message:'Server error.',error:err.message}); }
});

// ── WEATHER ROUTES ──────────────────────────────────────────
app.post('/api/weather/save', async (req,res) => {
  try {
    await Weather.findOneAndUpdate({city:req.body.city},{...req.body,updatedAt:new Date()},{upsert:true,new:true});
    res.json({message:'Weather cached!'});
  } catch(err){ res.status(500).json({message:'Server error.',error:err.message}); }
});

app.get('/api/weather/:city', async (req,res) => {
  try {
    const w = await Weather.findOne({city:req.params.city});
    if(!w) return res.status(404).json({message:'No weather data found.'});
    res.json(w);
  } catch { res.status(500).json({message:'Server error.'}); }
});

// ── SEED DEFAULT MARKET DATA ────────────────────────────────
async function seedMarket(){
  if(await Market.countDocuments() > 0) return;
  await Market.insertMany([
    {commodity:'Rice (Paddy)', msp:2183, price:2310, change:1.2,  volume:'45,000 MT'},
    {commodity:'Maize',        msp:1962, price:2050, change:0.8,  volume:'28,000 MT'},
    {commodity:'Wheat',        msp:2275, price:2200, change:-1.2, volume:'62,000 MT'},
    {commodity:'Soybean',      msp:4600, price:4850, change:2.3,  volume:'15,000 MT'},
    {commodity:'Groundnut',    msp:6377, price:6500, change:1.9,  volume:'12,000 MT'},
    {commodity:'Onion',        msp:0,    price:2200, change:-3.5, volume:'8,000 MT'},
    {commodity:'Tomato',       msp:0,    price:4500, change:12.4, volume:'5,000 MT'},
    {commodity:'Urad Dal',     msp:7400, price:7650, change:1.1,  volume:'9,000 MT'},
  ]);
  console.log('✅  Default market prices seeded!');
}

// ── START SERVER ────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`🚀  AgroSense Backend → http://localhost:${PORT}`);
  await seedMarket();
});
