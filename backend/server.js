const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const servicesRoutes = require('./routes/serviceRoutes');
const adminRoutes = require('./routes/adminRoutes');
const providersRoutes = require('./routes/providers');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/providers', providersRoutes);

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// API index - friendly JSON for root /api
app.get('/api', (req, res) => {
	res.json({
		name: 'Tech Resque API',
		version: '1.0.0',
		routes: {
			auth: ['/api/auth/signup', '/api/auth/login'],
			services: ['/api/services (POST create)', '/api/services/my (GET customer)', '/api/services/assigned (GET provider)'],
			admin: ['/api/admin/users', '/api/admin/services', '/api/admin/assign'],
			providers: ['/api/providers (GET list)', '/api/providers/profile (POST)', '/api/providers/availability (PATCH)']
		}
	});
});

app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`Server running on ${HOST}:${PORT}`));
