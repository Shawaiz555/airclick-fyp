# AirClick Backend API

FastAPI backend for AirClick hand gesture recognition system.

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for database to be provisioned
4. Go to Settings → Database
5. Copy the connection string (URI format)

### 2. Run Database Setup

1. Go to SQL Editor in Supabase Dashboard
2. Open `supabase_setup.sql` file
3. Copy and paste the SQL commands
4. Click "Run" to create tables

### 3. Configure Environment

1. Copy `.env.example` to `.env`
2. Update `DATABASE_URL` with your Supabase connection string:
   ```
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

### 4. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 5. Run the Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### Gestures
- `POST /api/gestures/record` - Record a new gesture (requires auth)
- `GET /api/gestures/` - Get all user gestures (requires auth)
- `DELETE /api/gestures/{id}` - Delete a gesture (requires auth)

## Default Admin Account

- Email: `admin@airclick.com`
- Password: `admin123`
- **IMPORTANT**: Change this password after first login!

## Testing

Test the API using the interactive Swagger docs at http://localhost:8000/docs

## Production Deployment

For production deployment:
1. Change `SECRET_KEY` in `.env`
2. Update `FRONTEND_URL` to your production domain
3. Use a strong admin password
4. Enable SSL/TLS
