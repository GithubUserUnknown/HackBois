// MongoDB Atlas connection service
// This service handles all MongoDB operations for vehicle tracking

const MONGODB_URI = 'mongodb+srv://ashutoshkumar63041_db_user:f27NjO2RvRvD9uF3@cluster0.vlkkaba.mongodb.net/';
const DATABASE_NAME = 'carLocation';
const COLLECTION_NAME = 'location';

interface VehicleLocation {
  _id?: string;
  current_time: string;
  recognized_plate: string;
  address: {
    Street: string;
    City: string;
    State: string;
    Zip: string;
  };
  traffic_signal?: string;
  latitude?: number;
  longitude?: number;
}

interface AdvancedSearchFilters {
  plate?: string;
  trafficSignal?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

// Note: Since we're in a browser environment, we'll need to use a backend API
// to connect to MongoDB. Direct MongoDB connections from browsers are not secure.
// These functions will call backend API endpoints.

const API_BASE_URL = '/api/vehicles';

/**
 * Fetch the current (latest) location of a vehicle by plate number
 */
export async function getCurrentLocation(plate: string): Promise<VehicleLocation | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/current-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plate }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch current location');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching current location:', error);
    throw error;
  }
}

/**
 * Fetch the complete location history of a vehicle by plate number
 */
export async function getLocationHistory(plate: string): Promise<VehicleLocation[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/location-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plate }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch location history');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching location history:', error);
    throw error;
  }
}

/**
 * Perform advanced search with multiple filters
 */
export async function advancedSearch(filters: AdvancedSearchFilters): Promise<VehicleLocation[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/advanced-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(filters),
    });

    if (!response.ok) {
      throw new Error('Failed to perform advanced search');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error performing advanced search:', error);
    throw error;
  }
}

/**
 * Get all vehicles that passed through a specific traffic signal
 */
export async function getVehiclesByTrafficSignal(
  trafficSignal: string,
  startDate?: string,
  endDate?: string
): Promise<VehicleLocation[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/by-traffic-signal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trafficSignal, startDate, endDate }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch vehicles by traffic signal');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching vehicles by traffic signal:', error);
    throw error;
  }
}

export type { VehicleLocation, AdvancedSearchFilters };

