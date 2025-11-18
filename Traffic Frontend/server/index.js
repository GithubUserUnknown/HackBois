import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://ashutoshkumar63041_db_user:f27NjO2RvRvD9uF3@cluster0.vlkkaba.mongodb.net/';
const DATABASE_NAME = 'carLocation';
const COLLECTION_NAME = 'location';

let db;
let collection;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected to MongoDB Atlas');
    
    db = client.db(DATABASE_NAME);
    collection = db.collection(COLLECTION_NAME);
    
    // Create indexes for better query performance
    await collection.createIndex({ recognized_plate: 1 });
    await collection.createIndex({ current_time: -1 });
    await collection.createIndex({ traffic_signal: 1 });
    
    console.log('Database indexes created');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// API Routes

/**
 * Get recent vehicle locations (top 10 most recent records)
 */
app.get('/api/vehicles/recent', async (req, res) => {
  try {
    const results = await collection
      .find({})
      .sort({ current_time: -1 })
      .limit(10)
      .toArray();

    res.json(results);
  } catch (error) {
    console.error('Error fetching recent vehicles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all vehicle locations (latest for each vehicle)
 */
app.get('/api/vehicles/all', async (req, res) => {
  try {
    // Get all unique plates and their latest location
    const results = await collection.aggregate([
      {
        $sort: { current_time: -1 }
      },
      {
        $group: {
          _id: '$recognized_plate',
          latestRecord: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$latestRecord' }
      },
      {
        $sort: { current_time: -1 }
      },
      {
        $limit: 100 // Limit to 100 most recent vehicles
      }
    ]).toArray();

    res.json(results);
  } catch (error) {
    console.error('Error fetching all vehicles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get current (latest) location of a vehicle by plate number
 */
app.post('/api/vehicles/current-location', async (req, res) => {
  try {
    const { plate } = req.body;
    
    if (!plate) {
      return res.status(400).json({ error: 'Plate number is required' });
    }
    
    const result = await collection
      .find({ recognized_plate: plate })
      .sort({ current_time: -1 })
      .limit(1)
      .toArray();
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'No location found for this vehicle' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching current location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get complete location history of a vehicle by plate number
 */
app.post('/api/vehicles/location-history', async (req, res) => {
  try {
    const { plate } = req.body;
    
    if (!plate) {
      return res.status(400).json({ error: 'Plate number is required' });
    }
    
    const results = await collection
      .find({ recognized_plate: plate })
      .sort({ current_time: -1 })
      .toArray();
    
    res.json(results);
  } catch (error) {
    console.error('Error fetching location history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Advanced search with multiple filters
 */
app.post('/api/vehicles/advanced-search', async (req, res) => {
  try {
    const { plate, street, city, state, zip, startDate, endDate } = req.body;

    // Build query object
    const query = {};

    if (plate) {
      query.recognized_plate = { $regex: plate, $options: 'i' };
    }

    if (street) {
      query['address.Street'] = { $regex: street, $options: 'i' };
    }

    if (city) {
      query['address.City'] = { $regex: city, $options: 'i' };
    }

    if (state) {
      query['address.State'] = { $regex: state, $options: 'i' };
    }

    if (zip) {
      query['address.Zip'] = { $regex: zip, $options: 'i' };
    }

    // Handle date filters
    if (startDate || endDate) {
      query.current_time = {};

      if (startDate) {
        const startDateTime = new Date(`${startDate}T00:00:00`);
        query.current_time.$gte = startDateTime.toISOString();
      }

      if (endDate) {
        const endDateTime = new Date(`${endDate}T23:59:59`);
        query.current_time.$lte = endDateTime.toISOString();
      }
    }

    const results = await collection
      .find(query)
      .sort({ current_time: -1 })
      .limit(1000) // Limit to prevent overwhelming results
      .toArray();

    res.json(results);
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all vehicles that passed through a specific traffic signal
 */
app.post('/api/vehicles/by-traffic-signal', async (req, res) => {
  try {
    const { trafficSignal, startDate, endDate } = req.body;
    
    if (!trafficSignal) {
      return res.status(400).json({ error: 'Traffic signal is required' });
    }
    
    const query = { traffic_signal: trafficSignal };
    
    if (startDate || endDate) {
      query.current_time = {};
      
      if (startDate) {
        query.current_time.$gte = new Date(`${startDate}T00:00:00`).toISOString();
      }
      
      if (endDate) {
        query.current_time.$lte = new Date(`${endDate}T23:59:59`).toISOString();
      }
    }
    
    const results = await collection
      .find(query)
      .sort({ current_time: -1 })
      .limit(1000)
      .toArray();
    
    res.json(results);
  } catch (error) {
    console.error('Error fetching vehicles by traffic signal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get all unique traffic signals
 */
app.get('/api/vehicles/traffic-signals', async (req, res) => {
  try {
    const signals = await collection.distinct('traffic_signal');
    res.json(signals.filter(s => s)); // Filter out null/undefined values
  } catch (error) {
    console.error('Error fetching traffic signals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get statistics
 */
app.get('/api/vehicles/stats', async (req, res) => {
  try {
    const totalRecords = await collection.countDocuments();
    const uniqueVehicles = await collection.distinct('recognized_plate');
    const uniqueSignals = await collection.distinct('traffic_signal');
    
    res.json({
      totalRecords,
      uniqueVehicles: uniqueVehicles.length,
      uniqueSignals: uniqueSignals.filter(s => s).length
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Start server
async function startServer() {
  await connectToMongoDB();
  
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}/api`);
  });
}

startServer();

