# DatasetCleaner AI - Technical Specification

## 1. Project Overview

**Project Name:** DatasetCleaner AI
**Type:** SaaS Web Application
**Core Functionality:** Automated data cleaning and preprocessing platform for machine learning datasets
**Target Users:** Data scientists, ML engineers, analysts who need to quickly clean and prepare datasets

## 2. Tech Stack

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Data Processing:** Pandas, NumPy
- **Database:** PostgreSQL with SQLAlchemy ORM
- **Authentication:** JWT with python-jose
- **File Storage:** Local filesystem with UUID naming

### Frontend
- **Framework:** Next.js 16 (React 19)
- **Styling:** CSS Modules with custom properties
- **Charts:** Recharts
- **HTTP Client:** Fetch API
- **State Management:** React Context + Hooks

### Infrastructure
- **Dev Server:** Vite (for backend proxy during dev)
- **Package Manager:** Bun

## 3. UI/UX Specification

### Color Palette
```css
--bg-primary: #0a0a0f;
--bg-secondary: #12121a;
--bg-tertiary: #1a1a24;
--bg-card: #16161f;
--accent-primary: #00d4aa;
--accent-secondary: #7c3aed;
--accent-warning: #f59e0b;
--accent-error: #ef4444;
--accent-success: #10b981;
--text-primary: #f4f4f5;
--text-secondary: #a1a1aa;
--text-muted: #71717a;
--border-color: #27272a;
--gradient-primary: linear-gradient(135deg, #00d4aa 0%, #7c3aed 100%);
```

### Typography
- **Headings:** "JetBrains Mono", monospace
- **Body:** "IBM Plex Sans", sans-serif
- **Data/Code:** "JetBrains Mono", monospace
- **Font Sizes:**
  - H1: 2.5rem (40px)
  - H2: 1.75rem (28px)
  - H3: 1.25rem (20px)
  - Body: 0.9375rem (15px)
  - Small: 0.8125rem (13px)

### Layout Structure

#### Header (64px height)
- Logo (left): "DatasetCleaner AI" with gradient text
- Navigation (center): Dashboard, My Datasets, Pricing
- User Menu (right): Profile dropdown, subscription badge

#### Main Content Area
- Full viewport height minus header
- Sidebar (280px) for dataset navigation
- Main panel for data operations

### Pages & Components

#### 1. Landing Page (/)
- Hero section with animated gradient background
- Feature highlights in 3-column grid
- Pricing cards
- CTA buttons

#### 2. Authentication Pages (/login, /register)
- Centered card (400px max-width)
- Form with email/password fields
- OAuth buttons placeholder

#### 3. Dashboard (/dashboard)
- Welcome banner with user stats
- Recent datasets grid (3 columns)
- Quick actions panel
- Storage usage meter

#### 4. Dataset Upload (/upload)
- Drag-and-drop zone (dashed border, hover glow)
- File list with progress bars
- Size limit indicator
- Plan-based restrictions

#### 5. Data Analysis (/dataset/[id])
- Tabbed interface: Preview | Analysis | Clean | Export
- **Preview Tab:** Paginated data table with column headers
- **Analysis Tab:**
  - Quality score card (circular progress)
  - Issues grid (missing, duplicates, outliers, etc.)
  - Missing value heatmap
  - Column distribution charts
- **Clean Tab:**
  - Suggested fixes list with checkboxes
  - One-click apply button
  - Custom cleaning options panel
- **Export Tab:**
  - Download button
  - Format options

### Component States

#### Buttons
- Default: bg-accent-primary, text-black
- Hover: brightness(1.1), scale(1.02)
- Active: scale(0.98)
- Disabled: opacity(0.5), cursor-not-allowed

#### Cards
- Background: var(--bg-card)
- Border: 1px solid var(--border-color)
- Border-radius: 12px
- Hover: border-color: var(--accent-primary)

#### Data Table
- Striped rows (alternating bg-secondary)
- Sticky header
- Hover highlight
- Sortable columns with indicators

### Animations
- Page transitions: fade-in 300ms ease-out
- Card hover: transform 200ms ease
- Button press: scale 150ms ease
- Loading: pulse animation on skeleton
- Progress: smooth width transitions

## 4. Functionality Specification

### Authentication System
- JWT-based authentication
- Access token (15min) + Refresh token (7 days)
- Password hashing with bcrypt
- Email validation

### User Management
- User registration with email verification (optional)
- Profile management
- Subscription tier tracking

### Dataset Upload
- Accept: .csv files only
- Size limits:
  - Free: 5MB max
  - Pro: 100MB max
- Parse with pandas.read_csv
- Store metadata in PostgreSQL
- Store actual files in /uploads directory

### Data Quality Analysis

#### Missing Values Detection
- Count nulls per column
- Calculate percentage
- Identify patterns (MCAR, MAR, MNAR)

#### Duplicate Detection
- Find exact duplicate rows
- Find near-duplicate categorical values

#### Outlier Detection
- IQR method for numeric columns
- Z-score method (>3 std deviations)

#### Inconsistent Categories
- Case inconsistencies (e.g., "Male" vs "male")
- Whitespace issues
- Typos in categories

#### Class Imbalance
- Distribution analysis for classification targets
- Ratio calculation

### Cleaning Operations

#### Available Operations
1. Remove duplicates
2. Fill missing: mean/median/mode/custom
3. Drop columns (>50% nulls)
4. Drop rows with nulls
5. Normalize: min-max, z-score
6. Encode: label encoding, one-hot
7. Remove outliers
8. Trim whitespace
9. Standardize case

#### Suggested Fixes Algorithm
- Auto-generate suggestions based on analysis
- Prioritize by impact
- Show before/after estimates

### Subscription Plans

#### Free Plan
- Dataset size: 5MB max
- Storage: 100MB
- Operations: 10/month
- Features: Basic cleaning

#### Pro Plan ($19/month)
- Dataset size: 100MB max
- Storage: 5GB
- Unlimited operations
- Advanced cleaning (outlier detection, encoding)
- Priority support

### Database Schema

```sql
-- Users
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  name VARCHAR(255),
  subscription_tier ENUM('free', 'pro'),
  storage_used BIGINT DEFAULT 0,
  operations_used INT DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Datasets
datasets (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255),
  original_filename VARCHAR(255),
  file_path VARCHAR(500),
  file_size BIGINT,
  row_count INT,
  column_count INT,
  columns JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Cleaning History
cleaning_operations (
  id UUID PRIMARY KEY,
  dataset_id UUID REFERENCES datasets(id),
  operation_type VARCHAR(100),
  parameters JSONB,
  created_at TIMESTAMP
)
```

### API Endpoints

#### Auth
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- GET /api/auth/me

#### Datasets
- POST /api/datasets/upload
- GET /api/datasets (list user datasets)
- GET /api/datasets/{id}
- DELETE /api/datasets/{id}
- GET /api/datasets/{id}/preview
- GET /api/datasets/{id}/download

#### Analysis
- GET /api/datasets/{id}/analysis

#### Cleaning
- GET /api/datasets/{id}/suggestions
- POST /api/datasets/{id}/clean

## 5. Acceptance Criteria

### Authentication
- [ ] User can register with email/password
- [ ] User can login and receive JWT
- [ ] Protected routes require valid token
- [ ] Token refresh works correctly

### Dataset Upload
- [ ] CSV files can be uploaded via drag-drop or click
- [ ] File size validation works (5MB free, 100MB pro)
- [ ] Preview shows first 100 rows
- [ ] Column types are correctly identified

### Data Analysis
- [ ] Missing values are detected and displayed
- [ ] Duplicate rows are counted
- [ ] Outliers are identified with method shown
- [ ] Quality score is calculated (0-100)

### Cleaning
- [ ] Suggestions are generated based on analysis
- [ ] Individual operations can be applied
- [ ] One-click apply runs all suggestions
- [ ] Results are reflected in preview

### Export
- [ ] Cleaned dataset can be downloaded as CSV
- [ ] Downloaded file matches preview

### Subscription
- [ ] Free tier limited to 5MB
- [ ] Pro tier shows unlimited capability
- [ ] Usage is tracked in database

### Visual
- [ ] Dark theme with accent colors
- [ ] Responsive layout (mobile: stacked, desktop: sidebar)
- [ ] Loading states shown during operations
- [ ] Error messages are user-friendly
