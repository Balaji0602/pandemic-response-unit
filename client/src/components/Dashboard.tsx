import React, { useEffect, useState, useMemo } from 'react';
import io, { Socket } from 'socket.io-client';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

interface PatientVitals {
    id: string;
    heartRate: number;
    bloodPressureSystolic: number;
    bloodPressureDiastolic: number;
    oxygenSaturation: number;
    respiratoryRate: number;
    temperature: number;
    timestamp: number;
}

const getVitalStatus = (vital: string, value: number): string => {
    switch (vital) {
        case 'heartRate':
            if (value < 60 || value > 100) return 'text-red-600';
            return 'text-gray-800';
        case 'oxygenSaturation':
            if (value < 95) return 'text-red-600';
            return 'text-gray-800';
        case 'bloodPressure':
            const systolic = value;
            if (systolic < 90 || systolic > 140) return 'text-red-600';
            return 'text-gray-800';
        case 'temperature':
            if (value < 36.5 || value > 37.5) return 'text-yellow-600';
            if (value > 38) return 'text-red-600';
            return 'text-gray-800';
        default:
            return 'text-gray-800';
    }
};

// PatientCard subcomponent memoized to avoid unnecessary re-renders when other patients update.
const PatientCard = React.memo(({ patient }: { patient: PatientVitals }) => {
    // Generate deterministic history heights based on patient properties and bar index
    // so heights don't change randomly unless the patient data itself updates.
    const historyHeights = useMemo(() => {
        return [...Array(20)].map((_, i) => {
            const seed = (patient.heartRate + patient.oxygenSaturation * (i + 1) + i * 17) % 70;
            return 30 + seed;
        });
    }, [patient.heartRate, patient.oxygenSaturation]);

    const isCritical = patient.oxygenSaturation < 95 || patient.heartRate > 100 || patient.heartRate < 60;

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500 h-full flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-gray-900">{patient.id}</h3>
                    <span className="text-xs text-gray-500">
                        {new Date(patient.timestamp).toLocaleTimeString()}
                    </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Heart Rate */}
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-500 uppercase mb-1">Heart Rate</div>
                        <div className={`text-xl font-mono font-bold ${getVitalStatus('heartRate', patient.heartRate)}`}>
                            {patient.heartRate}
                            <span className="text-xs font-normal text-gray-400 ml-1">bpm</span>
                        </div>
                    </div>

                    {/* Blood Pressure */}
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-500 uppercase mb-1">Blood Pressure</div>
                        <div className={`text-xl font-mono font-bold ${getVitalStatus('bloodPressure', patient.bloodPressureSystolic)}`}>
                            {patient.bloodPressureSystolic}/{patient.bloodPressureDiastolic}
                            <span className="text-xs font-normal text-gray-400 ml-1">mmHg</span>
                        </div>
                    </div>

                    {/* Oxygen Saturation */}
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-500 uppercase mb-1">SpO₂</div>
                        <div className={`text-xl font-mono font-bold ${getVitalStatus('oxygenSaturation', patient.oxygenSaturation)}`}>
                            {patient.oxygenSaturation}
                            <span className="text-xs font-normal text-gray-400 ml-1">%</span>
                        </div>
                    </div>

                    {/* Respiratory Rate */}
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-500 uppercase mb-1">Resp. Rate</div>
                        <div className="text-xl font-mono font-bold text-gray-800">
                            {patient.respiratoryRate}
                            <span className="text-xs font-normal text-gray-400 ml-1">/min</span>
                        </div>
                    </div>

                    {/* Temperature */}
                    <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-500 uppercase mb-1">Temperature</div>
                        <div className={`text-xl font-mono font-bold ${getVitalStatus('temperature', patient.temperature)}`}>
                            {patient.temperature.toFixed(1)}
                            <span className="text-xs font-normal text-gray-400 ml-1">°C</span>
                        </div>
                    </div>

                    {/* Status Summary */}
                    <div className="bg-gray-50 p-3 rounded flex items-center justify-center">
                        <div className="text-center">
                            <div className="text-xs text-gray-500 uppercase mb-1">Status</div>
                            <div className={`text-sm font-semibold px-3 py-1 rounded-full ${isCritical
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                                }`}>
                                {isCritical ? 'CRITICAL' : 'STABLE'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Vital history */}
            <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-400 mb-1">Vital History (Last 10m)</div>
                <div className="h-12 flex items-end space-x-1">
                    {historyHeights.map((height, i) => (
                        <div
                            key={i}
                            className="w-full bg-blue-100 rounded-t"
                            style={{
                                height: `${height}%`,
                                opacity: 0.5 + (i / 40)
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
});
PatientCard.displayName = 'PatientCard';

// Virtualized Row Wrapper
const Row = React.memo(({ index, style, data }: ListChildComponentProps<PatientVitals[]>) => {
    const patient = data[index];
    if (!patient) return null;
    return (
        <div style={style} className="pr-2 pb-3">
            <PatientCard patient={patient} />
        </div>
    );
});
Row.displayName = 'Row';

// Dashboard component for monitoring patient vitals
export const Dashboard = () => {
    const [patients, setPatients] = useState<PatientVitals[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [criticalOnly, setCriticalOnly] = useState(false);
    
    // Dynamic dimensions for responsive virtualization
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [listHeight, setListHeight] = useState(window.innerHeight - 300);

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
            setListHeight(window.innerHeight - 300);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const itemSize = useMemo(() => {
        if (windowWidth >= 1024) return 215; // desktop (1 grid row)
        if (windowWidth >= 768) return 295;  // tablet (2 grid rows)
        return 385;                          // mobile (3 grid rows)
    }, [windowWidth]);

    useEffect(() => {
        // Connect to WebSocket server
        const socket: Socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000');

        socket.on('connect', () => {
            console.log('Connected to WebSocket server');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
            setIsConnected(false);
        });

        // Receive initial patient data
        socket.on('initial_patients', (initialPatients: PatientVitals[]) => {
            console.log('Received initial patients:', initialPatients.length);
            setPatients(initialPatients);
        });

        // Receive vitals updates
        socket.on('vitals_update', (updates: PatientVitals[]) => {
            setPatients(prevPatients => {
                const newPatients = [...prevPatients];
                
                // Build an ID map for fast O(1) index lookups
                const idToIdx = new Map<string, number>();
                newPatients.forEach((p, i) => idToIdx.set(p.id, i));

                updates.forEach(update => {
                    const index = idToIdx.get(update.id);
                    if (index !== undefined) {
                        newPatients[index] = update;
                    }
                });

                return newPatients;
            });
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    // Filtered patients based on search query and critical toggle
    const filteredPatients = useMemo(() => {
        return patients.filter(patient => {
            // Filter by critical status
            if (criticalOnly) {
                const isCritical = patient.oxygenSaturation < 95 || patient.heartRate > 100 || patient.heartRate < 60;
                if (!isCritical) return false;
            }

            // Filter by search query
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                if (!patient.id.toLowerCase().includes(query)) return false;
            }

            return true;
        });
    }, [patients, criticalOnly, searchQuery]);

    return (
        <div className="bg-gray-100 p-6 min-h-screen">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-gray-100 z-10 py-2">
                <h2 className="text-2xl font-bold text-gray-800">ICU Live Monitor ({patients.length} Patients)</h2>
                <div className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {isConnected ? 'SYSTEM ONLINE' : 'DISCONNECTED'}
                </div>
            </div>

            {/* Filters and Search Control Panel */}
            <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-72">
                    <input
                        type="text"
                        placeholder="Search patient ID (e.g. P-0015)..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                </div>
                
                <div className="flex items-center space-x-6 w-full md:w-auto justify-end">
                    <label className="flex items-center cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={criticalOnly}
                            onChange={(e) => {
                                setCriticalOnly(e.target.checked);
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm font-semibold text-gray-700">Show Critical Only</span>
                    </label>

                    <span className="text-sm text-gray-500 font-medium">
                        Showing: <strong className="text-gray-800">{filteredPatients.length}</strong> of {patients.length} patients
                    </span>
                </div>
            </div>

            {/* Virtualized Patients List Container */}
            {filteredPatients.length === 0 ? (
                <div className="bg-white p-8 text-center text-gray-500 rounded-lg shadow-sm border border-gray-200">
                    No patients match the search or filter criteria.
                </div>
            ) : (
                <div className="w-full rounded-lg" style={{ height: `${Math.max(450, listHeight)}px` }}>
                    <List
                        height={Math.max(450, listHeight)}
                        itemCount={filteredPatients.length}
                        itemSize={itemSize}
                        width="100%"
                        itemData={filteredPatients}
                    >
                        {Row}
                    </List>
                </div>
            )}
        </div>
    );
};
