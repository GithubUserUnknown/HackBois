import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import {
  Car,
  MapPin,
  Clock,
  Search,
  History,
  Filter,
  RefreshCw,
  List
} from 'lucide-react';

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
}

interface AdvancedFilters {
  plate: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  startDate: string;
  endDate: string;
}

export function TrackVehiclesPanel() {
  const [activeTab, setActiveTab] = useState('current');
  const [recentVehicles, setRecentVehicles] = useState<VehicleLocation[]>([]);
  const [currentLocationPlate, setCurrentLocationPlate] = useState('');
  const [historyPlate, setHistoryPlate] = useState('');
  const [currentLocation, setCurrentLocation] = useState<VehicleLocation | null>(null);
  const [locationHistory, setLocationHistory] = useState<VehicleLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRecentData, setShowRecentData] = useState(true);

  // Advanced search filters
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    plate: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    startDate: '',
    endDate: ''
  });
  const [advancedResults, setAdvancedResults] = useState<VehicleLocation[]>([]);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  // Fetch recent vehicles on component mount
  useEffect(() => {
    fetchRecentVehicles();
  }, []);

  const fetchRecentVehicles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/vehicles/recent', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentVehicles(data);
        setShowRecentData(true);
      }
    } catch (error) {
      console.error('Error fetching recent vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch current location
  const handleCurrentLocationSearch = async () => {
    if (!currentLocationPlate.trim()) return;

    setLoading(true);
    setShowRecentData(false); // Hide recent data when user searches
    try {
      const response = await fetch('/api/vehicles/current-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: currentLocationPlate })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentLocation(data);
      } else {
        setCurrentLocation(null);
        alert('No location found for this vehicle');
      }
    } catch (error) {
      console.error('Error fetching current location:', error);
      alert('Error fetching vehicle location');
    } finally {
      setLoading(false);
    }
  };

  // Fetch location history
  const handleHistorySearch = async () => {
    if (!historyPlate.trim()) return;

    setLoading(true);
    setShowRecentData(false); // Hide recent data when user searches
    try {
      const response = await fetch('/api/vehicles/location-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate: historyPlate })
      });

      if (response.ok) {
        const data = await response.json();
        setLocationHistory(data);
      } else {
        setLocationHistory([]);
        alert('No history found for this vehicle');
      }
    } catch (error) {
      console.error('Error fetching location history:', error);
      alert('Error fetching location history');
    } finally {
      setLoading(false);
    }
  };

  // Advanced search
  const handleAdvancedSearch = async () => {
    setLoading(true);
    setShowRecentData(false); // Hide recent data when user searches
    try {
      // Build query object with only non-empty filters
      const filters: any = {};
      if (advancedFilters.plate) filters.plate = advancedFilters.plate;
      if (advancedFilters.street) filters.street = advancedFilters.street;
      if (advancedFilters.city) filters.city = advancedFilters.city;
      if (advancedFilters.state) filters.state = advancedFilters.state;
      if (advancedFilters.zip) filters.zip = advancedFilters.zip;
      if (advancedFilters.startDate) filters.startDate = advancedFilters.startDate;
      if (advancedFilters.endDate) filters.endDate = advancedFilters.endDate;

      const response = await fetch('/api/vehicles/advanced-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });

      if (response.ok) {
        const data = await response.json();
        setAdvancedResults(data);
      } else {
        setAdvancedResults([]);
        alert('No results found');
      }
    } catch (error) {
      console.error('Error in advanced search:', error);
      alert('Error performing search');
    } finally {
      setLoading(false);
    }
  };

  const resetAdvancedFilters = () => {
    setAdvancedFilters({
      plate: '',
      street: '',
      city: '',
      state: '',
      zip: '',
      startDate: '',
      endDate: ''
    });
    setAdvancedResults([]);
    setShowRecentData(true); // Show recent data again when filters are reset
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Car className="w-5 h-5" />
                Track Vehicles
              </CardTitle>
              <CardDescription>
                Monitor vehicle locations and access historical tracking data
              </CardDescription>
            </div>
            <Button onClick={fetchRecentVehicles} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="current">
                <MapPin className="w-4 h-4 mr-2" />
                Current Location
              </TabsTrigger>
              <TabsTrigger value="history">
                <History className="w-4 h-4 mr-2" />
                Location History
              </TabsTrigger>
            </TabsList>

            {/* Current Location Tab */}
            <TabsContent value="current" className="space-y-4">
              <div className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="current-plate">Vehicle Number Plate</Label>
                    <Input
                      id="current-plate"
                      placeholder="Enter vehicle number plate (e.g., 29A33185)"
                      value={currentLocationPlate}
                      onChange={(e) => setCurrentLocationPlate(e.target.value.toUpperCase())}
                      onKeyPress={(e) => e.key === 'Enter' && handleCurrentLocationSearch()}
                    />
                  </div>
                  <Button onClick={handleCurrentLocationSearch} disabled={loading}>
                    <Search className="w-4 h-4 mr-2" />
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                  <Button
                    onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                    variant="outline"
                  >
                    <Filter className="w-4 h-4 mr-2" />
                    Advanced
                  </Button>
                </div>

                {/* Advanced Search Panel */}
                {showAdvancedSearch && (
                  <Card className="bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>Advanced Search Filters</span>
                        <Button onClick={resetAdvancedFilters} variant="ghost" size="sm">
                          Reset
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="adv-plate">Vehicle Plate</Label>
                          <Input
                            id="adv-plate"
                            placeholder="Enter plate number"
                            value={advancedFilters.plate}
                            onChange={(e) => setAdvancedFilters({...advancedFilters, plate: e.target.value.toUpperCase()})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="adv-street">Street</Label>
                          <Input
                            id="adv-street"
                            placeholder="Enter street name"
                            value={advancedFilters.street}
                            onChange={(e) => setAdvancedFilters({...advancedFilters, street: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="adv-city">City</Label>
                          <Input
                            id="adv-city"
                            placeholder="Enter city"
                            value={advancedFilters.city}
                            onChange={(e) => setAdvancedFilters({...advancedFilters, city: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="adv-state">State</Label>
                          <Input
                            id="adv-state"
                            placeholder="Enter state"
                            value={advancedFilters.state}
                            onChange={(e) => setAdvancedFilters({...advancedFilters, state: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="adv-zip">ZIP Code</Label>
                          <Input
                            id="adv-zip"
                            placeholder="Enter ZIP code"
                            value={advancedFilters.zip}
                            onChange={(e) => setAdvancedFilters({...advancedFilters, zip: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start-date">Start Date</Label>
                          <Input
                            id="start-date"
                            type="date"
                            value={advancedFilters.startDate}
                            onChange={(e) => setAdvancedFilters({...advancedFilters, startDate: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="end-date">End Date</Label>
                          <Input
                            id="end-date"
                            type="date"
                            value={advancedFilters.endDate}
                            onChange={(e) => setAdvancedFilters({...advancedFilters, endDate: e.target.value})}
                          />
                        </div>
                      </div>

                      <Button onClick={handleAdvancedSearch} disabled={loading} className="w-full">
                        <Search className="w-4 h-4 mr-2" />
                        {loading ? 'Searching...' : 'Search with Filters'}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Display Results */}
                {currentLocation && !showAdvancedSearch && (
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Car className="w-5 h-5" />
                          {currentLocation.recognized_plate}
                        </span>
                        <Badge variant="default">Latest Location</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3 font-medium">Time</th>
                              <th className="text-left p-3 font-medium">Plate</th>
                              <th className="text-left p-3 font-medium">Street</th>
                              <th className="text-left p-3 font-medium">City</th>
                              <th className="text-left p-3 font-medium">State</th>
                              <th className="text-left p-3 font-medium">ZIP</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b hover:bg-muted/50">
                              <td className="p-3">{new Date(currentLocation.current_time).toLocaleString()}</td>
                              <td className="p-3 font-medium">{currentLocation.recognized_plate}</td>
                              <td className="p-3">{currentLocation.address.Street}</td>
                              <td className="p-3">{currentLocation.address.City}</td>
                              <td className="p-3">{currentLocation.address.State}</td>
                              <td className="p-3">{currentLocation.address.Zip}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Advanced Search Results */}
                {advancedResults.length > 0 && showAdvancedSearch && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Search Results</CardTitle>
                        <Badge variant="secondary">{advancedResults.length} records found</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-background">
                            <tr className="border-b">
                              <th className="text-left p-3 font-medium">Time</th>
                              <th className="text-left p-3 font-medium">Plate</th>
                              <th className="text-left p-3 font-medium">Street</th>
                              <th className="text-left p-3 font-medium">City</th>
                              <th className="text-left p-3 font-medium">State</th>
                              <th className="text-left p-3 font-medium">ZIP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {advancedResults.map((record, index) => (
                              <tr key={index} className="border-b hover:bg-muted/50">
                                <td className="p-3">{new Date(record.current_time).toLocaleString()}</td>
                                <td className="p-3 font-medium">{record.recognized_plate}</td>
                                <td className="p-3">{record.address.Street}</td>
                                <td className="p-3">{record.address.City}</td>
                                <td className="p-3">{record.address.State}</td>
                                <td className="p-3">{record.address.Zip}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent Vehicle Data - Show when no search is active */}
                {showRecentData && recentVehicles.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Recent Vehicle Locations</CardTitle>
                        <Badge variant="secondary">{recentVehicles.length} recent records</Badge>
                      </div>
                      <CardDescription>
                        Showing the most recent vehicle location data
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-background">
                            <tr className="border-b">
                              <th className="text-left p-3 font-medium">Time</th>
                              <th className="text-left p-3 font-medium">Plate</th>
                              <th className="text-left p-3 font-medium">Street</th>
                              <th className="text-left p-3 font-medium">City</th>
                              <th className="text-left p-3 font-medium">State</th>
                              <th className="text-left p-3 font-medium">ZIP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentVehicles.map((record, index) => (
                              <tr key={index} className="border-b hover:bg-muted/50">
                                <td className="p-3">{new Date(record.current_time).toLocaleString()}</td>
                                <td className="p-3 font-medium">{record.recognized_plate}</td>
                                <td className="p-3">{record.address.Street}</td>
                                <td className="p-3">{record.address.City}</td>
                                <td className="p-3">{record.address.State}</td>
                                <td className="p-3">{record.address.Zip}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* Location History Tab */}
            <TabsContent value="history" className="space-y-4">
              <div className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="history-plate">Vehicle Number Plate</Label>
                    <Input
                      id="history-plate"
                      placeholder="Enter vehicle number plate (e.g., 29A33185)"
                      value={historyPlate}
                      onChange={(e) => setHistoryPlate(e.target.value.toUpperCase())}
                      onKeyPress={(e) => e.key === 'Enter' && handleHistorySearch()}
                    />
                  </div>
                  <Button onClick={handleHistorySearch} disabled={loading}>
                    <Search className="w-4 h-4 mr-2" />
                    {loading ? 'Searching...' : 'Search History'}
                  </Button>
                </div>

                {locationHistory.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">
                          Location History for {historyPlate}
                        </CardTitle>
                        <Badge variant="secondary">{locationHistory.length} records found</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-background">
                            <tr className="border-b">
                              <th className="text-left p-3 font-medium">Time</th>
                              <th className="text-left p-3 font-medium">Plate</th>
                              <th className="text-left p-3 font-medium">Street</th>
                              <th className="text-left p-3 font-medium">City</th>
                              <th className="text-left p-3 font-medium">State</th>
                              <th className="text-left p-3 font-medium">ZIP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {locationHistory.map((record, index) => (
                              <tr key={index} className="border-b hover:bg-muted/50">
                                <td className="p-3">{new Date(record.current_time).toLocaleString()}</td>
                                <td className="p-3 font-medium">{record.recognized_plate}</td>
                                <td className="p-3">{record.address.Street}</td>
                                <td className="p-3">{record.address.City}</td>
                                <td className="p-3">{record.address.State}</td>
                                <td className="p-3">{record.address.Zip}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {locationHistory.length === 0 && historyPlate && !loading && (
                  <Card className="bg-muted/30">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      No location history found for plate number: {historyPlate}
                    </CardContent>
                  </Card>
                )}

                {/* Recent Vehicle Data - Show when no search is active */}
                {showRecentData && recentVehicles.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Recent Vehicle Locations</CardTitle>
                        <Badge variant="secondary">{recentVehicles.length} recent records</Badge>
                      </div>
                      <CardDescription>
                        Showing the most recent vehicle location data
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full">
                          <thead className="sticky top-0 bg-background">
                            <tr className="border-b">
                              <th className="text-left p-3 font-medium">Time</th>
                              <th className="text-left p-3 font-medium">Plate</th>
                              <th className="text-left p-3 font-medium">Street</th>
                              <th className="text-left p-3 font-medium">City</th>
                              <th className="text-left p-3 font-medium">State</th>
                              <th className="text-left p-3 font-medium">ZIP</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentVehicles.map((record, index) => (
                              <tr key={index} className="border-b hover:bg-muted/50">
                                <td className="p-3">{new Date(record.current_time).toLocaleString()}</td>
                                <td className="p-3 font-medium">{record.recognized_plate}</td>
                                <td className="p-3">{record.address.Street}</td>
                                <td className="p-3">{record.address.City}</td>
                                <td className="p-3">{record.address.State}</td>
                                <td className="p-3">{record.address.Zip}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}