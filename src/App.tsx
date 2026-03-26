import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useNavigate,
  Navigate
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  getDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Hazard, CommunityPost, SafeLocation } from './types';
import { 
  Shield, 
  MapPin, 
  AlertTriangle, 
  MessageSquare, 
  LayoutDashboard, 
  LogOut, 
  LogIn,
  Plus,
  CheckCircle2,
  Clock,
  User as UserIcon,
  Menu,
  X,
  Navigation,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet default icon issue
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Auth Context ---
interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        let userDoc;
        try {
          userDoc = await getDoc(doc(db, 'users', user.uid));
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
          return;
        }
        
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          // Force admin role if email matches
          if (user.email === 'sargamshabina06@gmail.com' && data.role !== 'admin') {
            try {
              await setDoc(doc(db, 'users', user.uid), { role: 'admin' }, { merge: true });
              setProfile({ ...data, role: 'admin' });
            } catch (error) {
              handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
            }
          } else {
            setProfile(data);
          }
        } else {
          const newProfile: UserProfile = {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            role: user.email === 'sargamshabina06@gmail.com' ? 'admin' : 'user',
            createdAt: new Date().toISOString(),
          };
          try {
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Components ---

const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: 'user' | 'official' | 'admin' }> = ({ children, requiredRole }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-white/70">Verifying access...</div>;
  if (!user) return <Navigate to="/" />;

  if (requiredRole) {
    const roles = ['user', 'official', 'admin'];
    const userRoleIndex = roles.indexOf(profile?.role || 'user');
    const requiredRoleIndex = roles.indexOf(requiredRole);
    if (userRoleIndex < requiredRoleIndex) {
      return (
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-500">You do not have the required permissions ({requiredRole}) to view this page.</p>
          <Link to="/" className="mt-6 inline-block text-blue-600 font-medium hover:underline">Return Home</Link>
        </div>
      );
    }
  }

  return <>{children}</>;
};

const AdminPanel = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [safeLocations, setSafeLocations] = useState<SafeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'hazards' | 'safe-locations'>('users');

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(
      query(collection(db, 'users'), orderBy('createdAt', 'desc')), 
      (snapshot) => {
        setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'users')
    );
    
    const unsubscribeHazards = onSnapshot(
      query(collection(db, 'hazards'), orderBy('timestamp', 'desc')), 
      (snapshot) => {
        setHazards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hazard)));
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'hazards')
    );

    const unsubscribeSafeLocations = onSnapshot(
      query(collection(db, 'safeLocations')), 
      (snapshot) => {
        setSafeLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafeLocation)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'safeLocations')
    );

    return () => {
      unsubscribeUsers();
      unsubscribeHazards();
      unsubscribeSafeLocations();
    };
  }, []);

  const updateUserRole = async (uid: string, newRole: 'user' | 'official' | 'admin') => {
    try {
      await setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const updateHazardStatus = async (id: string, status: 'verified' | 'resolved') => {
    try {
      await setDoc(doc(db, 'hazards', id), { status }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `hazards/${id}`);
    }
  };

  const deleteUser = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const deleteHazard = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this hazard report?')) return;
    try {
      await deleteDoc(doc(db, 'hazards', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `hazards/${id}`);
    }
  };

  const deleteSafeLocation = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this safe location?')) return;
    try {
      await deleteDoc(doc(db, 'safeLocations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `safeLocations/${id}`);
    }
  };

  const seedSampleData = async () => {
    const samples: Partial<SafeLocation>[] = [
      // Coastal Cities
      { name: 'Mumbai Emergency Shelter', description: 'Large capacity shelter with medical facilities.', locality: 'Mumbai', coordinates: { latitude: 19.0760, longitude: 72.8777 }, type: 'shelter' },
      { name: 'Chennai Coastal Hospital', description: 'Specialized in maritime injuries and emergency care.', locality: 'Chennai', coordinates: { latitude: 13.0827, longitude: 80.2707 }, type: 'hospital' },
      { name: 'Kochi Port Police', description: 'Maritime security and rescue coordination center.', locality: 'Kochi', coordinates: { latitude: 9.9312, longitude: 76.2673 }, type: 'police' },
      { name: 'Vizag Cyclone Center', description: 'Reinforced building for extreme weather protection.', locality: 'Visakhapatnam', coordinates: { latitude: 17.6868, longitude: 83.2185 }, type: 'shelter' },
      { name: 'Goa Rescue Base', description: 'Primary base for coastal rescue operations.', locality: 'Goa', coordinates: { latitude: 15.2993, longitude: 74.1240 }, type: 'other' },
      { name: 'Kolkata River Shelter', description: 'Safe zone for riverine and coastal communities.', locality: 'Kolkata', coordinates: { latitude: 22.5726, longitude: 88.3639 }, type: 'shelter' },
      { name: 'Mangalore Port Hospital', description: 'Emergency medical services for port and coastal areas.', locality: 'Mangalore', coordinates: { latitude: 12.9141, longitude: 74.8560 }, type: 'hospital' },
      { name: 'Surat Coastal Guard', description: 'Coastal monitoring and emergency response station.', locality: 'Surat', coordinates: { latitude: 21.1702, longitude: 72.8311 }, type: 'police' },
      { name: 'Paradip Cyclone Shelter', description: 'Dedicated shelter for high-intensity storms.', locality: 'Paradip', coordinates: { latitude: 20.2706, longitude: 86.6664 }, type: 'shelter' },
      { name: 'Tuticorin Marine Base', description: 'Rescue and relief coordination for the southern coast.', locality: 'Tuticorin', coordinates: { latitude: 8.8049, longitude: 78.1460 }, type: 'other' },
      
      // Major Inland Cities
      { name: 'Delhi Central Relief Hub', description: 'Coordination center for national emergency response.', locality: 'Delhi', coordinates: { latitude: 28.6139, longitude: 77.2090 }, type: 'other' },
      { name: 'Bangalore Disaster Management', description: 'Tech-enabled monitoring and response center.', locality: 'Bangalore', coordinates: { latitude: 12.9716, longitude: 77.5946 }, type: 'other' },
      { name: 'Hyderabad Emergency Hospital', description: 'Large scale trauma and emergency medical center.', locality: 'Hyderabad', coordinates: { latitude: 17.3850, longitude: 78.4867 }, type: 'hospital' },
      { name: 'Ahmedabad Shelter Complex', description: 'Multi-purpose emergency housing and relief center.', locality: 'Ahmedabad', coordinates: { latitude: 23.0225, longitude: 72.5714 }, type: 'shelter' },
      { name: 'Pune Civil Defense Base', description: 'Training and response base for civil emergencies.', locality: 'Pune', coordinates: { latitude: 18.5204, longitude: 73.8567 }, type: 'police' },
      { name: 'Lucknow Relief Center', description: 'Centralized aid distribution and shelter point.', locality: 'Lucknow', coordinates: { latitude: 26.8467, longitude: 80.9462 }, type: 'shelter' },
      { name: 'Jaipur Emergency Services', description: 'Integrated police and medical response unit.', locality: 'Jaipur', coordinates: { latitude: 26.9124, longitude: 75.7873 }, type: 'police' },
      { name: 'Nagpur Logistics Hub', description: 'Strategic storage and distribution of emergency supplies.', locality: 'Nagpur', coordinates: { latitude: 21.1458, longitude: 79.0882 }, type: 'other' },
      { name: 'Indore Medical Base', description: 'Advanced medical facility for regional emergencies.', locality: 'Indore', coordinates: { latitude: 22.7196, longitude: 75.8577 }, type: 'hospital' },
      { name: 'Patna Flood Relief Center', description: 'Specialized center for riverine flood response.', locality: 'Patna', coordinates: { latitude: 25.5941, longitude: 85.1376 }, type: 'shelter' },
      { name: 'Bhopal Disaster Response', description: 'State-level emergency management headquarters.', locality: 'Bhopal', coordinates: { latitude: 23.2599, longitude: 77.4126 }, type: 'other' },
      { name: 'Chandigarh Safety Zone', description: 'Designated safe area for northern region coordination.', locality: 'Chandigarh', coordinates: { latitude: 30.7333, longitude: 76.7794 }, type: 'shelter' },
      { name: 'Guwahati Hill Shelter', description: 'Strategic shelter for northeast region emergencies.', locality: 'Guwahati', coordinates: { latitude: 26.1445, longitude: 91.7362 }, type: 'shelter' },
      { name: 'Bhubaneswar Cyclone HQ', description: 'Advanced tracking and response for eastern coast.', locality: 'Bhubaneswar', coordinates: { latitude: 20.2961, longitude: 85.8245 }, type: 'other' },
      { name: 'Thiruvananthapuram Coast Guard', description: 'Southernmost coastal security and rescue base.', locality: 'Thiruvananthapuram', coordinates: { latitude: 8.5241, longitude: 76.9366 }, type: 'police' },
    ];

    try {
      let addedCount = 0;
      for (const sample of samples) {
        // Simple duplicate check against current state
        if (!safeLocations.find(loc => loc.name === sample.name)) {
          await addDoc(collection(db, 'safeLocations'), sample);
          addedCount++;
        }
      }
      if (addedCount > 0) {
        alert(`${addedCount} new safe locations seeded successfully!`);
      } else {
        alert('All sample locations already exist.');
      }
    } catch (error) {
      console.error('Error seeding data:', error);
      alert('Failed to seed data.');
    }
  };

  const deduplicateSafeLocations = async () => {
    if (!window.confirm('This will remove all duplicate safe locations from the database. Continue?')) return;
    
    try {
      const seenNames = new Set<string>();
      const duplicates: string[] = [];
      
      safeLocations.forEach(loc => {
        if (seenNames.has(loc.name)) {
          duplicates.push(loc.id);
        } else {
          seenNames.add(loc.name);
        }
      });

      if (duplicates.length === 0) {
        alert('No duplicates found.');
        return;
      }

      for (const id of duplicates) {
        await deleteDoc(doc(db, 'safeLocations', id));
      }
      
      alert(`Successfully removed ${duplicates.length} duplicate locations.`);
    } catch (error) {
      console.error('Error deduplicating:', error);
      alert('Failed to remove duplicates.');
    }
  };

  if (loading) return <div className="p-8 text-center text-white/70">Loading admin panel...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Admin Console</h2>
          <p className="text-white/70">Manage users, hazards, and platform safety.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg text-slate-700">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Users
          </button>
          <button 
            onClick={() => setActiveTab('hazards')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'hazards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Hazards
          </button>
          <button 
            onClick={() => setActiveTab('safe-locations')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'safe-locations' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Safe Locations
          </button>
        </div>
      </div>

      <div className="mb-6 flex justify-end gap-2">
        <button 
          onClick={deduplicateSafeLocations}
          className="text-xs bg-red-50 text-red-600 border border-red-100 px-3 py-1.5 rounded hover:bg-red-100 transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Remove Duplicates
        </button>
        <button 
          onClick={seedSampleData}
          className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700 transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Seed Sample Safe Locations
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm text-slate-900">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">User</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Email</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Role</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((u) => (
                <tr key={u.uid} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={u.photoURL || ''} alt="" className="w-8 h-8 rounded-full" />
                      <span className="font-medium text-slate-900">{u.displayName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'official' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <select
                        value={u.role}
                        onChange={(e) => updateUserRole(u.uid, e.target.value as any)}
                        className="text-sm border border-slate-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                      >
                        <option value="user">User</option>
                        <option value="official">Official</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button 
                        onClick={() => deleteUser(u.uid)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'hazards' ? (
        <div className="grid grid-cols-1 gap-4">
          {hazards.map((h) => (
            <div key={h.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row justify-between gap-4 text-slate-900">
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    h.type === 'storm' ? 'bg-red-100 text-red-700' :
                    h.type === 'oil_spill' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {h.type.replace('_', ' ')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    h.status === 'resolved' ? 'bg-green-100 text-green-700' :
                    h.status === 'verified' ? 'bg-blue-100 text-blue-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {h.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{h.location.address}</h3>
                <p className="text-sm text-slate-500 mb-2">{h.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>By: {h.authorName}</span>
                  <span>{format(new Date(h.timestamp), 'MMM d, HH:mm')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {h.status === 'reported' && (
                  <button 
                    onClick={() => updateHazardStatus(h.id, 'verified')}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-500 transition-colors"
                  >
                    Verify
                  </button>
                )}
                {h.status !== 'resolved' && (
                  <button 
                    onClick={() => updateHazardStatus(h.id, 'resolved')}
                    className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-500 transition-colors"
                  >
                    Resolve
                  </button>
                )}
                <button 
                  onClick={() => deleteHazard(h.id)}
                  className="p-2 text-slate-400 hover:text-red-600 transition-colors border border-slate-200 rounded hover:border-red-200"
                  title="Delete Hazard"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm text-slate-900">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Location</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Locality</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Type</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {safeLocations.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{loc.name}</div>
                    <div className="text-xs text-slate-500 truncate max-w-xs">{loc.description}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{loc.locality || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider">
                      {loc.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => deleteSafeLocation(loc.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                      title="Delete Location"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Navbar = () => {
  const { user, profile, login, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Report', path: '/report', icon: AlertTriangle },
    { name: 'Safe Locations', path: '/safe-locations', icon: MapPin },
    { name: 'Media', path: '/media', icon: Navigation },
    { name: 'Analytics', path: '/analytics', icon: CheckCircle2 },
    { name: 'Community', path: '/community', icon: MessageSquare },
  ];

  if (profile?.role === 'admin') {
    navLinks.push({ name: 'Admin', path: '/admin', icon: Shield });
  }

  return (
    <nav className="bg-slate-900 text-white sticky top-0 z-50 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Samudrasetu" className="w-8 h-8 rounded-full bg-white p-0.5" />
              <span className="text-xl font-bold tracking-tight">SAMUDRASETU</span>
            </Link>
          </div>

          <div className="hidden lg:block">
            <div className="ml-10 flex items-baseline space-x-2">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  className="px-3 py-2 rounded-md text-xs font-medium hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <link.icon className="w-3.5 h-3.5" />
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="hidden md:block">
            {user ? (
              <div className="flex items-center gap-4">
                <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-slate-700" />
                  <span className="text-sm font-medium hidden xl:inline">{profile?.displayName}</span>
                </Link>
                <button
                  onClick={logout}
                  className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Login
              </button>
            )}
          </div>

          <div className="lg:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-slate-900 border-b border-slate-800"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium hover:bg-slate-800 flex items-center gap-2"
                >
                  <link.icon className="w-5 h-5" />
                  {link.name}
                </Link>
              ))}
              {user ? (
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-medium hover:bg-slate-800 flex items-center gap-2"
                >
                  <UserIcon className="w-5 h-5" />
                  Profile
                </Link>
              ) : (
                <button
                  onClick={() => { login(); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-md text-base font-medium hover:bg-slate-800 flex items-center gap-2"
                >
                  <LogIn className="w-5 h-5" />
                  Login
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// Calamity stock images per type — verified working Unsplash photo IDs
const CALAMITY_IMAGES: Record<string, string[]> = {
  storm: [
    'https://images.unsplash.com/photo-1561484930-998b6a7b22e8?w=800&q=80&fit=crop',
    'https://images.unsplash.com/photo-1504370805625-d32c054d388b?w=800&q=80&fit=crop',
    'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=800&q=80&fit=crop',
  ],
  oil_spill: [
    'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80&fit=crop',
    'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&q=80&fit=crop',
    'https://images.unsplash.com/photo-1611270418597-a6c77f4b7271?w=800&q=80&fit=crop',
  ],
  debris: [
    'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=800&q=80&fit=crop',
    'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=800&q=80&fit=crop',
    'https://images.unsplash.com/photo-1583484963886-cfe2bff2945f?w=800&q=80&fit=crop',
  ],
  other: [
    'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80&fit=crop',
    'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&q=80&fit=crop',
    'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&q=80&fit=crop',
  ],
};

interface MediaPost {
  id: string;
  imageUrl: string;
  caption: string;
  type: string;
  authorName: string;
  authorPhoto: string;
  authorUid: string;
  timestamp: string;
}

const MediaGallery = () => {
  const { user, profile } = useAuth();
  const [mediaPosts, setMediaPosts] = useState<MediaPost[]>([]);
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [caption, setCaption] = useState('');
  const [incidentType, setIncidentType] = useState('storm');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'community' | 'calamities'>('community');

  useEffect(() => {
    // Use simple collection query (no orderBy) to avoid needing Firestore index
    const q = query(collection(db, 'mediaPosts'));
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MediaPost));
        // Sort client-side to avoid needing composite index
        posts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setMediaPosts(posts);
        setLoading(false);
      },
      (error) => {
        console.error('mediaPosts error:', error);
        setLoading(false); // Don't hang on error
      }
    );
    const q2 = query(collection(db, 'hazards'));
    const u2 = onSnapshot(q2,
      (snapshot) => {
        setHazards(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Hazard)));
      },
      (error) => console.error('hazards error:', error)
    );
    return () => { unsubscribe(); u2(); };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!user || !imageDataUrl) return;
    setUploading(true);
    try {
      await addDoc(collection(db, 'mediaPosts'), {
        imageUrl: imageDataUrl,
        caption,
        type: incidentType,
        authorName: profile?.displayName || 'Anonymous',
        authorPhoto: user.photoURL || '',
        authorUid: user.uid,
        timestamp: new Date().toISOString(),
      });
      setCaption('');
      setImageDataUrl(null);
      setShowUpload(false);
    } catch (err) {
      console.error(err);
      alert('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const deletePost = async (id: string) => {
    if (!window.confirm('Delete this post?')) return;
    await deleteDoc(doc(db, 'mediaPosts', id));
  };

  if (loading) return <div className="p-8 text-center text-white/70">Loading gallery...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Media Gallery</h2>
          <p className="text-white/70">Visual evidence of maritime incidents from the community.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/10 p-1 rounded-lg">
            <button onClick={() => setActiveTab('community')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'community' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/70 hover:text-white'}`}>Community</button>
            <button onClick={() => setActiveTab('calamities')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'calamities' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/70 hover:text-white'}`}>Calamity Types</button>
          </div>
          {user && (
            <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
              <Plus className="w-4 h-4" />
              Upload Photo
            </button>
          )}
        </div>
      </div>

      {/* Upload Panel */}
      <AnimatePresence>
        {showUpload && user && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 bg-white rounded-2xl p-6 shadow-lg text-slate-900"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4">Upload Incident Photo</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Image</label>
                <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                {imageDataUrl && (
                  <img src={imageDataUrl} alt="preview" className="mt-3 h-40 w-full object-cover rounded-lg border border-slate-200" />
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Incident Type</label>
                  <select value={incidentType} onChange={e => setIncidentType(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="storm">Storm / Severe Weather</option>
                    <option value="debris">Floating Debris</option>
                    <option value="oil_spill">Oil Spill</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Caption</label>
                  <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={3} placeholder="Describe what you see..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div className="flex gap-3">
                  <button onClick={handleUpload} disabled={!imageDataUrl || uploading} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50">
                    {uploading ? 'Uploading...' : 'Submit'}
                  </button>
                  <button onClick={() => { setShowUpload(false); setImageDataUrl(null); setCaption(''); }} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === 'community' ? (
        mediaPosts.length === 0 ? (
          <div className="text-center py-20 text-white/50">
            <Plus className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No community photos yet. Be the first to upload!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {mediaPosts.map((post, index) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="group relative aspect-square overflow-hidden rounded-xl bg-slate-800 border border-slate-700"
              >
                <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <img src={post.authorPhoto} alt="" className="w-5 h-5 rounded-full" />
                    <span className="text-white/80 text-[10px]">{post.authorName}</span>
                  </div>
                  <span className="text-white text-xs font-bold uppercase tracking-wider mb-1">{post.type.replace('_', ' ')}</span>
                  {post.caption && <p className="text-white/70 text-[10px] line-clamp-2">{post.caption}</p>}
                  {(user?.uid === post.authorUid || profile?.role === 'admin') && (
                    <button onClick={() => deletePost(post.id)} className="mt-2 self-start p-1 bg-red-600/80 rounded text-white hover:bg-red-600 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )
      ) : (
        <div className="space-y-10">
          {(['storm', 'oil_spill', 'debris', 'other'] as const).map(type => (
            <div key={type}>
              <h3 className="text-xl font-bold text-white mb-4 capitalize flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                  type === 'storm' ? 'bg-red-500/20 text-red-300' :
                  type === 'oil_spill' ? 'bg-orange-500/20 text-orange-300' :
                  type === 'debris' ? 'bg-blue-500/20 text-blue-300' :
                  'bg-slate-500/20 text-slate-300'
                }`}>{type.replace('_', ' ')}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {CALAMITY_IMAGES[type].map((url, i) => (
                  <div key={i} className="aspect-video overflow-hidden rounded-xl bg-slate-800 border border-slate-700 relative">
                    <img
                      src={url}
                      alt={type}
                      loading="lazy"
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.img-fallback')) {
                          const fallback = document.createElement('div');
                          fallback.className = 'img-fallback absolute inset-0 flex flex-col items-center justify-center text-white/40 text-sm gap-2';
                          fallback.innerHTML = `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5'><rect x='3' y='3' width='18' height='18' rx='2'/><circle cx='8.5' cy='8.5' r='1.5'/><path d='m21 15-5-5L5 21'/></svg><span class='capitalize'>${type.replace('_', ' ')}</span>`;
                          parent.appendChild(fallback);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
              {/* Also show community uploads of this type */}
              {mediaPosts.filter(p => p.type === type).length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {mediaPosts.filter(p => p.type === type).map(post => (
                    <div key={post.id} className="aspect-square overflow-hidden rounded-lg bg-slate-800 border border-slate-700 relative group">
                      <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[9px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                        📸 {post.authorName}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Analytics = () => {
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'hazards'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hazard));
      setHazards(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <div className="p-8 text-center text-white/70">Loading analytics...</div>;

  const stats = {
    total: hazards.length,
    resolved: hazards.filter(h => h.status === 'resolved').length,
    verified: hazards.filter(h => h.status === 'verified').length,
    reported: hazards.filter(h => h.status === 'reported').length,
    byType: hazards.reduce((acc, h) => {
      acc[h.type] = (acc[h.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-white">Safety Analytics</h2>
        <p className="text-white/70">Data-driven insights into coastal safety and response efficiency.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-slate-900">
          <p className="text-sm font-medium text-slate-500 mb-1">Total Hazards</p>
          <p className="text-4xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-slate-900">
          <p className="text-sm font-medium text-slate-500 mb-1">Resolved</p>
          <p className="text-4xl font-bold text-green-600">{stats.resolved}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-slate-900">
          <p className="text-sm font-medium text-slate-500 mb-1">Verified</p>
          <p className="text-4xl font-bold text-blue-600">{stats.verified}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-slate-900">
          <p className="text-sm font-medium text-slate-500 mb-1">Pending</p>
          <p className="text-4xl font-bold text-orange-600">{stats.reported}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-slate-900">
          <h3 className="text-xl font-bold text-slate-900 mb-6">Hazards by Type</h3>
          <div className="space-y-4">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium capitalize">{type.replace('_', ' ')}</span>
                  <span className="text-slate-500">{count} reports</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${(count / stats.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center text-slate-900">
          <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Response Rate</h3>
          <p className="text-5xl font-bold text-slate-900 mb-4">
            {stats.total > 0 ? Math.round(((stats.resolved + stats.verified) / stats.total) * 100) : 0}%
          </p>
          <p className="text-slate-500">Of all reported hazards have been addressed by officials.</p>
        </div>
      </div>
    </div>
  );
};

const Profile = () => {
  const { user, profile } = useAuth();

  if (!user || !profile) return <Navigate to="/" />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center text-slate-900">
        <img src={user.photoURL || ''} alt="" className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-blue-50" />
        <h2 className="text-2xl font-bold text-slate-900 mb-1">{profile.displayName}</h2>
        <p className="text-slate-500 mb-6">{profile.email}</p>
        
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold uppercase tracking-wider mb-8">
          <Shield className="w-4 h-4" />
          {profile.role}
        </div>

        <div className="grid grid-cols-1 gap-4 text-left">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">User ID</p>
            <p className="text-sm font-mono text-slate-600 truncate">{profile.uid}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Member Since</p>
            <p className="text-sm text-slate-600">{format(new Date(profile.createdAt), 'MMMM d, yyyy')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 12);
  }, [center, map]);
  return null;
};

const Dashboard = () => {
  const { profile } = useAuth();
  const [hazards, setHazards] = useState<Hazard[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [userLocation, setUserLocation] = useState<[number, number]>([18.9220, 72.8347]); // Default Mumbai
  const [locationFound, setLocationFound] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'hazards'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Hazard));
      setHazards(data);
      setLoading(false);
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setLocationFound(true);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }

    return unsubscribe;
  }, []);

  const updateStatus = async (id: string, status: 'verified' | 'resolved') => {
    try {
      await setDoc(doc(db, 'hazards', id), { status }, { merge: true });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredHazards = filter === 'all' ? hazards : hazards.filter(h => h.type === filter);

  if (loading) return <div className="p-8 text-center text-white/70">Loading dashboard...</div>;

  const isOfficial = profile?.role === 'official' || profile?.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Live Hazard Feed</h2>
          <p className="text-white/70">Real-time monitoring of coastal and maritime threats.</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
          >
            <option value="all">All Hazards</option>
            <option value="storm">Storms</option>
            <option value="debris">Debris</option>
            <option value="oil_spill">Oil Spills</option>
          </select>
          <Link to="/report" className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-blue-500 transition-colors">
            <Plus className="w-4 h-4" />
            New Report
          </Link>
        </div>
      </div>

      {/* Real-time Map */}
      <div className="mb-12 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-[450px] relative z-0">
        <MapContainer 
          center={userLocation} 
          zoom={10} 
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={userLocation} />
          
          {/* User Marker */}
          {locationFound && (
            <Marker position={userLocation}>
              <Popup>
                <div className="text-center">
                  <p className="font-bold text-blue-600">Your Current Location</p>
                  <p className="text-xs text-slate-500">Stay alert for nearby hazards.</p>
                </div>
              </Popup>
            </Marker>
          )}

          {filteredHazards.map((hazard) => (
            <Marker 
              key={hazard.id} 
              position={[hazard.location.latitude, hazard.location.longitude]}
              icon={L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/564/564619.png', // Hazard icon
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
              })}
            >
              <Popup>
                <div className="p-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    hazard.type === 'storm' ? 'bg-red-100 text-red-700' :
                    hazard.type === 'oil_spill' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {hazard.type.replace('_', ' ')}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm">{hazard.location.address}</h4>
                  <p className="text-xs text-slate-500 mt-1">{hazard.description}</p>
                  <div className="mt-2 text-[10px] text-slate-400 flex justify-between">
                    <span>{hazard.status}</span>
                    <span>{format(new Date(hazard.timestamp), 'MMM d, HH:mm')}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHazards.map((hazard) => (
          <motion.div
            layout
            key={hazard.id}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col text-slate-900"
          >
            <div className="p-5 flex-grow">
              <div className="flex items-center justify-between mb-4">
                <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                  hazard.type === 'storm' ? 'bg-red-100 text-red-700' :
                  hazard.type === 'oil_spill' ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {hazard.type.replace('_', ' ')}
                </span>
                <span className={`flex items-center gap-1 text-xs font-medium ${
                  hazard.status === 'resolved' ? 'text-green-600' :
                  hazard.status === 'verified' ? 'text-blue-600' :
                  'text-slate-500'
                }`}>
                  {hazard.status === 'resolved' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {hazard.status}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-1">{hazard.location.address}</h3>
              <p className="text-slate-600 text-sm mb-4 line-clamp-3">{hazard.description}</p>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center">
                    <UserIcon className="w-3 h-3 text-slate-500" />
                  </div>
                  <span className="text-xs text-slate-500">{hazard.authorName}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {format(new Date(hazard.timestamp), 'MMM d, HH:mm')}
                </span>
              </div>
            </div>
            {isOfficial && hazard.status !== 'resolved' && (
              <div className="bg-slate-50 p-3 border-t border-slate-100 flex gap-2">
                {hazard.status === 'reported' && (
                  <button 
                    onClick={() => updateStatus(hazard.id, 'verified')}
                    className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded hover:bg-blue-500 transition-colors"
                  >
                    Verify
                  </button>
                )}
                <button 
                  onClick={() => updateStatus(hazard.id, 'resolved')}
                  className="flex-1 bg-green-600 text-white text-xs font-bold py-2 rounded hover:bg-green-500 transition-colors"
                >
                  Resolve
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const Home = () => {
  return (
    <section className="relative min-h-[calc(100vh-64px)] flex items-center px-6 overflow-hidden">
      
      {/* 🌊 Background GIF */}
      <div className="absolute inset-0 z-0">
        <img
          src="/water.gif"
          alt="water background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60"></div>
      </div>

      {/* ✨ Content */}
      <div className="relative z-10 max-w-4xl mx-auto w-full text-center">
        
        <div className="text-white">
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Bridging Communities with{" "}
            <span className="text-blue-400">Maritime Safety</span>
          </h1>

          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            SAMUDRASETU connects coastal communities with maritime officials,
            enabling real-time hazard reporting and coordinated emergency response
            for safer seas.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/report"
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold transition text-white"
            >
              Report a Hazard
            </Link>

            <Link
              to="/dashboard"
              className="bg-white/20 backdrop-blur-md border border-white/30 px-6 py-3 rounded-lg font-bold text-white hover:bg-white/30 transition"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

const ReportHazard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    type: 'storm',
    description: '',
    address: '',
    latitude: 0,
    longitude: 0
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert('Please login to report a hazard');
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'hazards'), {
        ...formData,
        location: {
          latitude: formData.latitude,
          longitude: formData.longitude,
          address: formData.address
        },
        status: 'reported',
        authorUid: user.uid,
        authorName: profile?.displayName || 'Anonymous',
        timestamp: new Date().toISOString()
      });
      navigate('/dashboard');
    } catch (error) {
      console.error('Error reporting hazard:', error);
      alert('Failed to report hazard. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-slate-900">
        <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          Report Maritime Hazard
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hazard Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 bg-white"
            >
              <option value="storm">Storm / Severe Weather</option>
              <option value="debris">Floating Debris</option>
              <option value="oil_spill">Oil Spill</option>
              <option value="other">Other Hazard</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Location Address</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. 5 miles off Mumbai Coast"
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                required
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                required
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 bg-white"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                  setFormData({
                    ...formData,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                  });
                });
              }
            }}
            className="text-sm text-blue-600 hover:text-blue-500 font-medium flex items-center gap-1"
          >
            <MapPin className="w-4 h-4" />
            Use My Current Location
          </button>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the hazard in detail..."
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 bg-white"
            ></textarea>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </div>
    </div>
  );
};

const SafeLocations = () => {
  const { user, profile } = useAuth();
  const [locations, setLocations] = useState<SafeLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '', description: '', locality: '',
    latitude: 0, longitude: 0, type: 'shelter' as SafeLocation['type']
  });

  const isOfficial = profile?.role === 'official' || profile?.role === 'admin';

  useEffect(() => {
    const q = query(collection(db, 'safeLocations'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafeLocation));
      setLocations(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isOfficial) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'safeLocations'), {
        name: formData.name,
        description: formData.description,
        locality: formData.locality,
        coordinates: { latitude: formData.latitude, longitude: formData.longitude },
        type: formData.type,
        addedBy: profile?.displayName || 'Official',
        addedByUid: user.uid,
        timestamp: new Date().toISOString(),
      });
      setFormData({ name: '', description: '', locality: '', latitude: 0, longitude: 0, type: 'shelter' });
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert('Failed to add location.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLocations = locations
    .filter((loc, index, self) =>
      index === self.findIndex((t) => t.name === loc.name)
    )
    .filter(loc =>
      loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.locality?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  if (loading) return <div className="p-8 text-center text-white/70">Loading safe locations...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Safe Locations</h2>
          <p className="text-white/70">Find the nearest shelters and emergency services.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-72">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by locality or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            />
          </div>
          {isOfficial && (
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap">
              <Plus className="w-4 h-4" />
              Add Location
            </button>
          )}
        </div>
      </div>

      {/* Add Location Form (officials/admins only) */}
      <AnimatePresence>
        {showForm && isOfficial && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 bg-white rounded-2xl p-6 shadow-lg text-slate-900"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Add Safe Location
            </h3>
            <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Mumbai Emergency Shelter" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Locality *</label>
                <input required value={formData.locality} onChange={e => setFormData({...formData, locality: e.target.value})} placeholder="e.g. Mumbai" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as SafeLocation['type']})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="shelter">Shelter</option>
                  <option value="hospital">Hospital</option>
                  <option value="police">Police / Coast Guard</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Latitude *</label>
                  <input required type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value)})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Longitude *</label>
                  <input required type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value)})} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description *</label>
                <textarea required rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe the facilities available..." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 bg-white outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-lg transition-colors disabled:opacity-50">
                  {submitting ? 'Adding...' : 'Add Location'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredLocations.length > 0 ? filteredLocations.map((loc) => (
          <div key={loc.id} className="bg-white border border-slate-200 rounded-xl p-6 flex gap-4 hover:border-blue-200 transition-colors group text-slate-900">
            <div className="bg-blue-50 p-3 rounded-lg h-fit group-hover:bg-blue-100 transition-colors">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-grow">
              <div className="flex justify-between items-start mb-1">
                <h3 className="text-xl font-bold text-slate-900">{loc.name}</h3>
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                  {loc.type}
                </span>
              </div>
              {loc.locality && <p className="text-xs font-medium text-blue-600 mb-2">{loc.locality}</p>}
              <p className="text-slate-600 text-sm mb-3">{loc.description}</p>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-400">
                <span className="flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  {loc.coordinates.latitude}, {loc.coordinates.longitude}
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${loc.coordinates.latitude},${loc.coordinates.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-500 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Google Maps
                </a>
              </div>
            </div>
          </div>
        )) : (
          <div className="col-span-full p-12 text-center bg-white/10 rounded-2xl border-2 border-dashed border-white/20">
            <MapPin className="w-12 h-12 text-white/30 mx-auto mb-4" />
            <p className="text-white/50">No safe locations found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Community = () => {
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'communityPosts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CommunityPost));
      setPosts(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPost.trim()) return;

    try {
      await addDoc(collection(db, 'communityPosts'), {
        authorUid: user.uid,
        authorName: profile?.displayName || 'Anonymous',
        authorPhoto: user.photoURL || '',
        content: newPost,
        timestamp: new Date().toISOString()
      });
      setNewPost('');
    } catch (error) {
      console.error('Error posting:', error);
    }
  };

  if (loading) return <div className="p-8 text-center text-white/70">Loading community...</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-white">Community Board</h2>
        <p className="text-white/70">Connect with other coastal residents and officials.</p>
      </div>

      {user && (
        <form onSubmit={handlePost} className="bg-white border border-slate-200 rounded-xl p-4 mb-8 shadow-sm text-slate-900">
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder="Share an update or ask a question..."
            className="w-full border-none focus:ring-0 text-slate-900 placeholder-slate-400 resize-none"
            rows={3}
          ></textarea>
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              disabled={!newPost.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-slate-900">
            <div className="flex items-center gap-3 mb-4">
              <img src={post.authorPhoto} alt="" className="w-10 h-10 rounded-full border border-slate-100" />
              <div>
                <h4 className="font-bold text-slate-900">{post.authorName}</h4>
                <span className="text-xs text-slate-400">{format(new Date(post.timestamp), 'MMM d, HH:mm')}</span>
              </div>
            </div>
            <p className="text-slate-700 leading-relaxed">{post.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  // Force title and favicon regardless of what index.html says
  React.useEffect(() => {
    document.title = 'Samudrasetu';
    const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement('link');
    link.type = 'image/png';
    link.rel = 'icon';
    link.href = '/logo.png';
    document.head.appendChild(link);
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[url('/water.gif')] bg-cover bg-center bg-fixed font-sans">
          
          {/* Overlay */}
          <div className="min-h-screen bg-black/40 text-white">

            <Navbar />

            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/report" element={
                  <ProtectedRoute>
                    <ReportHazard />
                  </ProtectedRoute>
                } />
                <Route path="/safe-locations" element={<SafeLocations />} />
                <Route path="/media" element={<MediaGallery />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/community" element={
                  <ProtectedRoute>
                    <Community />
                  </ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminPanel />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>

            <footer className="bg-slate-900/70 backdrop-blur-md text-slate-400 py-12 border-t border-slate-800">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <img src="/logo.png" alt="Samudrasetu" className="w-6 h-6 rounded-full bg-white p-0.5" />
                      <span className="text-lg font-bold text-white tracking-tight">SAMUDRASETU</span>
                    </div>
                    <p className="text-sm">
                      Empowering coastal communities through technology and real-time maritime safety monitoring.
                    </p>
                  </div>

                  <div>
                    <h4 className="text-white font-bold mb-4">Quick Links</h4>
                    <ul className="space-y-2 text-sm">
                      <li><Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
                      <li><Link to="/report" className="hover:text-white transition-colors">Report Hazard</Link></li>
                      <li><Link to="/safe-locations" className="hover:text-white transition-colors">Safe Locations</Link></li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-white font-bold mb-4">Emergency</h4>
                    <p className="text-sm mb-2">Maritime Helpline: 1554</p>
                    <p className="text-sm">Coastal Police: 1093</p>
                  </div>

                </div>

                <div className="mt-12 pt-8 border-t border-slate-800 text-center text-xs">
                  &copy; {new Date().getFullYear()} SAMUDRASETU. All rights reserved.
                </div>
              </div>
            </footer>

          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}
