const mongoose = require('mongoose');

// FARMER MODEL
const farmerSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:    { type: String, trim: true },
  password: { type: String, required: true },
  language: { type: String, enum: ['en','ta','hi'], default: 'en' },
  location: { city: String, state: String, lat: Number, lon: Number },
  createdAt:{ type: Date, default: Date.now }
});

// CROP RECOMMENDATION MODEL
const cropSchema = new mongoose.Schema({
  farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  inputs: {
    nitrogen: Number, phosphorus: Number, potassium: Number,
    ph: Number, temperature: Number, humidity: Number,
    rainfall: Number, moisture: Number
  },
  result: {
    cropName: String, confidence: Number,
    alternatives: [String], advice: String
  },
  createdAt: { type: Date, default: Date.now }
});

// DISEASE DETECTION MODEL
const diseaseSchema = new mongoose.Schema({
  farmerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Farmer', required: true },
  imageName: { type: String },
  result: {
    diseaseName: String, confidence: Number,
    severity: String, solution: String
  },
  createdAt: { type: Date, default: Date.now }
});

// MARKET PRICES MODEL
const marketSchema = new mongoose.Schema({
  commodity: { type: String, required: true },
  msp:       { type: Number },
  price:     { type: Number },
  change:    { type: Number },
  volume:    { type: String },
  updatedAt: { type: Date, default: Date.now }
});

// WEATHER CACHE MODEL
const weatherSchema = new mongoose.Schema({
  city:        String, lat: Number, lon: Number,
  temperature: Number, humidity: Number,
  windSpeed:   Number, feelsLike: Number,
  description: String, updatedAt: { type: Date, default: Date.now }
});

module.exports = {
  Farmer:  mongoose.model('Farmer',  farmerSchema),
  Crop:    mongoose.model('Crop',    cropSchema),
  Disease: mongoose.model('Disease', diseaseSchema),
  Market:  mongoose.model('Market',  marketSchema),
  Weather: mongoose.model('Weather', weatherSchema)
};
