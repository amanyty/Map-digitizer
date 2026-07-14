const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');
const fs = require('fs');

const firebaseConfig = {
  projectId: "map-digitizer-baskhedi",
  appId: "1:511025802785:web:5165ca12f8d7787325fd60",
  storageBucket: "map-digitizer-baskhedi.firebasestorage.app",
  apiKey: "AIzaSyDny17QoBAyeBdXUM0Tzw1ePOEB0uzUi70",
  authDomain: "map-digitizer-baskhedi.firebaseapp.com",
  messagingSenderId: "511025802785"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

async function uploadData() {
  console.log("Reading GeoJSON...");
  const data = JSON.parse(fs.readFileSync('baskhedi_georeferenced.geojson', 'utf8'));
  const features = data.features;
  
  console.log(`Found ${features.length} features. Uploading to Firestore...`);
  
  const batch = db.batch();
  let count = 0;
  
  for (const feature of features) {
    const docRef = db.collection('features').doc(); // Auto-generate ID
    const featureData = JSON.parse(JSON.stringify(feature)); // deep clone
    featureData.geometry.coordinates = JSON.stringify(featureData.geometry.coordinates);
    
    batch.set(docRef, featureData);
    count++;
    
    if (count % 500 === 0) {
      await batch.commit();
      console.log(`Committed ${count} features`);
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log("Upload complete!");
  process.exit(0);
}

uploadData().catch(console.error);
