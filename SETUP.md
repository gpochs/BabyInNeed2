# Setup Guide for Baby in Need App

## 🚀 Quick Start

### 1. Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Admin Access
NEXT_PUBLIC_ADMIN_CODE=your_admin_secret_code_here

# Email Configuration (Resend)
RESEND_API_KEY=your_resend_api_key_here

# Email Settings
NOTIFY_FROM=Baby in Need <noreply@yourdomain.com>
RECIPIENTS_TO=parent1@example.com,parent2@example.com
```

### 2. Database Setup

Run the SQL schema in your Supabase project:

```sql
-- Copy the contents of sql/schema.sql and run it in your Supabase SQL editor
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

## 🔐 Admin Access

1. Enter your admin code in the password field
2. Click the "🔐 Anmelden" button
3. You'll see "👑 Admin-Modus" when successfully logged in

## 📧 Email Setup

1. Create a Resend account at [resend.com](https://resend.com)
2. Get your API key
3. Add it to your `.env.local` file
4. Verify your domain (optional but recommended)

## 🎮 Game Features

- **20x20 Grid**: Optimized for mobile devices
- **Touch Controls**: Mobile-friendly directional buttons
- **Keyboard Support**: Arrow keys for desktop
- **Responsive Design**: Works on all screen sizes

## 🛠️ Admin Features

- Add new items with categories and priorities
- Delete items
- Manage email recipients
- View all items and their status

## 📱 Mobile Optimization

- Responsive grid layout
- Touch-friendly controls
- Optimized for small screens
- Fast loading and smooth animations




