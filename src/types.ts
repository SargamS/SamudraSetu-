export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: 'user' | 'official' | 'admin';
  createdAt: string;
}

export interface Hazard {
  id: string;
  type: 'storm' | 'debris' | 'oil_spill' | 'other';
  description: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  status: 'reported' | 'verified' | 'resolved';
  authorUid: string;
  authorName: string;
  timestamp: string;
  imageUrl?: string;
}

export interface SafeLocation {
  id: string;
  name: string;
  description: string;
  locality?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  type: 'shelter' | 'hospital' | 'police' | 'other';
}

export interface CommunityPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  timestamp: string;
}
