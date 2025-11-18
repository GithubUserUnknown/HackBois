import { MongoClient } from 'mongodb';

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://ashutoshkumar63041_db_user:f27NjO2RvRvD9uF3@cluster0.vlkkaba.mongodb.net/';
const DATABASE_NAME = 'carLocation';
const COLLECTION_NAME = 'location';

// Sample data
const vehiclePlates = ['ABC123', 'XYZ789', 'DEF456', 'GHI012', 'JKL345'];
const streets = ['Main Street', 'Oak Avenue', 'Park Boulevard', 'Elm Street', 'Maple Drive'];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
const states = ['NY', 'CA', 'IL', 'TX', 'AZ'];
const zips = ['10001', '90001', '60601', '77001', '85001'];
const trafficSignals = ['Signal_001', 'Signal_002', 'Signal_003', 'Signal_004', 'Signal_005'];

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRandomDate(daysBack = 30) {
  const now = new Date();
  const randomDays = Math.floor(Math.random() * daysBack);
  const randomHours = Math.floor(Math.random() * 24);
  const randomMinutes = Math.floor(Math.random() * 60);
  
  const date = new Date(now);
  date.setDate(date.getDate() - randomDays);
  date.setHours(randomHours, randomMinutes, 0, 0);
  
  return date.toISOString();
}

function generateVehicleLocation() {
  const cityIndex = Math.floor(Math.random() * cities.length);
  
  return {
    current_time: generateRandomDate(),
    recognized_plate: getRandomElement(vehiclePlates),
    address: {
      Street: getRandomElement(streets),
      City: cities[cityIndex],
      State: states[cityIndex],
      Zip: zips[cityIndex]
    },
    traffic_signal: getRandomElement(trafficSignals),
    latitude: 40.7128 + (Math.random() - 0.5) * 0.1,
    longitude: -74.0060 + (Math.random() - 0.5) * 0.1
  };
}

async function generateTestData(count = 100) {
  let client;
  
  try {
    console.log('Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('Connected successfully!');
    
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    
    console.log(`Generating ${count} test records...`);
    const testData = [];
    
    for (let i = 0; i < count; i++) {
      testData.push(generateVehicleLocation());
    }
    
    console.log('Inserting test data into MongoDB...');
    const result = await collection.insertMany(testData);
    
    console.log(`✅ Successfully inserted ${result.insertedCount} records!`);
    
    // Show some statistics
    const totalRecords = await collection.countDocuments();
    const uniqueVehicles = await collection.distinct('recognized_plate');
    const uniqueSignals = await collection.distinct('traffic_signal');
    
    console.log('\n📊 Database Statistics:');
    console.log(`   Total Records: ${totalRecords}`);
    console.log(`   Unique Vehicles: ${uniqueVehicles.length}`);
    console.log(`   Unique Signals: ${uniqueSignals.length}`);
    console.log('\n🚗 Sample Vehicles:', uniqueVehicles.join(', '));
    console.log('🚦 Sample Signals:', uniqueSignals.join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nConnection closed.');
    }
  }
}

// Get count from command line argument or use default
const count = parseInt(process.argv[2]) || 100;

console.log('========================================');
console.log('Vehicle Location Test Data Generator');
console.log('========================================\n');

generateTestData(count);

