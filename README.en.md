# ikun-tab

A beautiful and practical browser tab homepage application, supporting personalized customization, widget plugins, bookmark group management, and more. Self-hostable, single instance with multi-user support.

## ✨ Features

### 📑 Bookmark Management
- **Group Management**: Create multiple bookmark groups and switch quickly via the Orbital Dock
- **Folder Support**: Drag bookmarks onto each other to create folders
- **Smart Sorting**: Custom bookmark sorting with important content pinned to the top
- **Drag & Drop**: Move, merge, and drag bookmarks out of folders

### 🔍 Search
- **Multi-Engine**: Built-in search engines with custom additions
- **Quick Switch**: Fast default-engine switching
- **Direct Search**: Enter keywords to jump straight to results

### 🧩 Widget System
- **Calendar**: Date, weekday, month navigation
- **Clock**: Real-time clock (12/24h)
- **Countdown**: Countdown to a target date
- **Trending Lists**: Aggregated trending rankings (Weibo, Douyin, Bilibili, Zhihu, etc.)
- **Weather**: Based on geolocation or a custom city
- **Custom Panel**: Embed any URL via iframe

### 🎨 Personalization
- **Theme**: Light / Dark / Follow system
- **Background**: Bing daily image / random image / upload
- **Animation**: Toggle background floating effect
- **Window Mode**: Open bookmarks in a new tab or the current page

### 🔐 User System
- **Registration**: Username + password
- **Secure Login**: JWT in an httpOnly cookie — no repeated login on new tabs
- **Persistence**: All configs sync automatically after login

## 🛠 Tech Stack

### Frontend
- **Vue 3** + **TypeScript**
- **Vite** - build tool
- **Pinia** - state management
- **Vue Router** - routing
- **TailwindCSS** - atomic CSS
- **Axios** - HTTP client

### Backend
- **Python 3.12**
- **FastAPI** - async web framework
- **Uvicorn** (uvloop + httptools) - ASGI server
- **SQLAlchemy 2.0 (async)** + **aiomysql** - async ORM & MySQL driver
- **Pydantic v2** + **pydantic-settings** - validation & config
- **PyJWT** + **passlib[bcrypt]** - JWT & password hashing
- **httpx** / **orjson** - external proxy & high-performance JSON

### Data Storage
- **MySQL 8** - relational database
- **In-process TTL cache** - for hotlist / weather / favicon (no Redis, lower memory)

### Deployment
- **Docker** + **Docker Compose** - one-click (MySQL + app)

> Single-worker memory footprint ~80MB, a significant reduction from the earlier Java Spring Boot version (~280MB).

## 📂 Project Structure

```
ikun-tab/
├── frontend/                 # Vue3 frontend
│   ├── src/
│   │   ├── api/             # API layer (axios + R<T> interceptor)
│   │   ├── components/       # Vue components
│   │   │   ├── widgets/      # Widgets (hotlist/weather/clock/calendar/countdown/custom)
│   │   │   └── ...
│   │   ├── composables/      # Composables
│   │   ├── pages/            # Pages
│   │   ├── router/           # Routing
│   │   ├── store/            # Pinia stores
│   │   ├── utils/            # Utilities (bookmark icons / grid layout)
│   │   └── style.css         # Global styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── backend-py/               # Python FastAPI backend
│   ├── app/
│   │   ├── main.py           # Entry (lifespan / CORS / exception handlers / static)
│   │   ├── config.py         # Env config (IKUN_ prefix)
│   │   ├── database.py       # Async SQLAlchemy engine & session
│   │   ├── deps.py           # Dependencies: current user / db session
│   │   ├── security.py       # JWT & bcrypt
│   │   ├── response.py       # Unified R<T> response
│   │   ├── exceptions.py     # Business exceptions
│   │   ├── seed.py           # Demo data seeding
│   │   ├── models/           # SQLAlchemy models (tab_*)
│   │   ├── schemas/          # Pydantic request / response models
│   │   ├── routers/          # Routers (auth/bookmarks/groups/proxy/...)
│   │   └── services/         # Business logic
│   ├── requirements.txt
│   └── .dockerignore
│
├── .trae/documents/         # Product docs
│   ├── PRD.md
│   └── TechnicalArchitecture.md
│
├── Dockerfile               # Multi-stage build (frontend + Python)
├── docker-compose.yml       # Docker orchestration (MySQL + app)
└── README.md
```

## 🚀 Quick Start

### Requirements

- Node.js 18+
- Python 3.12+
- MySQL 8.0+

### Backend

1. Create the database:
```sql
CREATE DATABASE ikuntab DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Install dependencies:
```bash
cd backend-py
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt
```

3. Configure environment variables (create a `.env` in `backend-py/`, or export them). All settings use the `IKUN_` prefix:
```ini
IKUN_ENV=dev
IKUN_MYSQL_HOST=127.0.0.1
IKUN_MYSQL_PORT=3306
IKUN_MYSQL_DB=ikuntab
IKUN_MYSQL_USER=root
IKUN_MYSQL_PASSWORD=your_password
IKUN_JWT_SECRET=your_long_random_jwt_secret
IKUN_JWT_COOKIE_NAME=ikun_token
IKUN_UPLOAD_DIR=/tmp/ikun-uploads
IKUN_CORS_ORIGINS=*
# Hotlist aggregator service URL (optional, default http://localhost:3000)
IKUN_HOTLIST_API_URL=http://localhost:3000
```

4. Start the backend:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8090 --reload
```

> Tables are created automatically on startup via SQLAlchemy `Base.metadata.create_all`. The first startup also seeds a demo account **demo / demo123456** — no manual SQL import required.

### Frontend

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Start the dev server (`/api` and `/uploads` are proxied to `localhost:8090`):
```bash
npm run dev
```

3. Build for production (output to `dist/`):
```bash
npm run build
```

> In production, the `Dockerfile` builds the frontend and copies it to `backend-py/static/` to be served by FastAPI.

### Docker

One-click deployment with Docker Compose (MySQL + app):
```bash
docker-compose up -d
```

Visit `http://localhost:8090`. Log in with **demo / demo123456** to explore.

## 📡 API

Unified response `R<T>`: `{ "code": 0, "msg": "ok", "data": T }`; `code !== 0` indicates a business error.

### Auth
| Endpoint | Method | Description |
|------|------|------|
| `/api/auth/register` | POST | Register |
| `/api/auth/login` | POST | Login (sets httpOnly cookie) |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Current user |

### Bookmarks
| Endpoint | Method | Description |
|------|------|------|
| `/api/bookmarks` | GET | List (?groupId=) |
| `/api/bookmarks` | POST | Create bookmark / folder |
| `/api/bookmarks/{id}` | PUT | Update |
| `/api/bookmarks/{id}` | DELETE | Delete |
| `/api/bookmarks/move` | PUT | Move / reorder |

### Groups
| Endpoint | Method | Description |
|------|------|------|
| `/api/groups` | GET | List |
| `/api/groups` | POST | Create |
| `/api/groups/{id}` | PUT | Update |
| `/api/groups/{id}` | DELETE | Delete |
| `/api/groups/sort` | PUT | Reorder |

### Widgets
| Endpoint | Method | Description |
|------|------|------|
| `/api/widgets` | GET | List (?groupId=) |
| `/api/widgets` | POST | Create |
| `/api/widgets/{id}` | PUT | Update |
| `/api/widgets/{id}` | DELETE | Delete |
| `/api/widgets/move` | PUT | Move / layout |

### Search Engines
| Endpoint | Method | Description |
|------|------|------|
| `/api/search-engines` | GET | List |
| `/api/search-engines` | POST | Create |
| `/api/search-engines/{id}` | PUT | Update |
| `/api/search-engines/{id}` | DELETE | Delete |

### Proxy
| Endpoint | Method | Description |
|------|------|------|
| `/api/favicon` | GET | Favicon (?url=) |
| `/api/weather` | GET | Weather (?city=&lat=&lon=) |
| `/api/hotlist` | GET | Trending list (?source=) |

### Settings / Upload
| Endpoint | Method | Description |
|------|------|------|
| `/api/settings` | GET | Get settings |
| `/api/settings` | PUT | Update settings |
| `/api/upload` | POST | Upload image (bookmark icon / wallpaper) |

## 📝 License

This project is open-source under the MIT License.

## 🤝 Contributing

Welcome to submit Issues and Pull Requests to help improve the project.
