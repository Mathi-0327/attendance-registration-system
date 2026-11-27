# AttendReg - Real-Time Attendance Management System

<div align="center">

![AttendReg Logo](https://img.shields.io/badge/AttendReg-Attendance%20System-blue?style=for-the-badge)

**A modern, real-time web-based attendance management solution for educational institutions**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-404D59?style=flat-square&logo=express)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

[Live Demo](#) • [Documentation](#features) • [Installation](#installation) • [Screenshots](#screenshots)

</div>

---

## 🎯 Overview

**AttendReg** is a comprehensive, real-time attendance management system that revolutionizes traditional attendance tracking. Built with modern web technologies, it provides instant updates, robust security, and an intuitive user experience for both administrators and students.

### ✨ Key Highlights

- 🚀 **Real-Time Updates** - WebSocket-based live attendance feed
- 🔒 **Secure** - Multi-layer security with network validation
- 📊 **Comprehensive Reporting** - Export to CSV, Excel, PDF, and Google Slides
- 🎮 **Gamification** - Attendance streaks to encourage participation
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- 💾 **Data Persistence** - SQLite database with 100% data retention
- 🌐 **Network-Based** - No expensive hardware required
- ⚡ **Fast** - Sub-second response times

---

## 🚀 Features

### For Administrators

- **Session Management**
  - Start/stop attendance sessions with custom names
  - Configure late arrival thresholds
  - View complete session history
  
- **Real-Time Monitoring**
  - Live attendance feed with instant updates
  - Real-time statistics dashboard
  - Department-wise breakdown charts

- **Advanced Reporting**
  - Export to multiple formats (CSV, Excel, PDF, Google Slides)
  - Search and filter capabilities
  - Bulk operations support

- **Student Management**
  - View all registered students
  - Manage student accounts
  - Track individual attendance records

- **QR Code Access**
  - Auto-generated QR codes for quick mobile access
  - Display in classrooms for easy scanning

### For Students

- **Quick Attendance Submission**
  - Simple, intuitive form
  - Instant confirmation
  - Duplicate prevention

- **Personal Dashboard**
  - View attendance history
  - Track attendance streaks 🔥
  - Monitor attendance percentage
  - View session-wise records

- **Gamification**
  - Attendance streak tracking
  - Achievement badges
  - Progress visualization

### Security Features

- 🔐 Password hashing (SHA-256)
- 🌐 Network validation (same LAN requirement)
- 🚫 Duplicate submission prevention
- 🔄 Device claiming mechanism
- ⏱️ Rate limiting (10 submissions per IP per session)
- 🛡️ Input validation and sanitization

---

## 🛠️ Technology Stack

### Frontend
- **React 18.2** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Framer Motion** - Animations
- **React Query** - Server state management
- **Recharts** - Data visualization

### Backend
- **Node.js 18+** - Runtime
- **Express.js** - Web framework
- **WebSocket (ws)** - Real-time communication
- **SQLite** - Database
- **Drizzle ORM** - Type-safe database queries
- **TypeScript** - Type safety

### Additional Libraries
- **date-fns** - Date manipulation
- **qrcode.react** - QR code generation
- **xlsx** - Excel export
- **jspdf** - PDF generation
- **sonner** - Toast notifications

---

## 📸 Screenshots

### Homepage
![Homepage](screenshots/homepage.png)
*Clean, modern landing page with easy navigation*

### Admin Dashboard
![Admin Dashboard](screenshots/admin-dashboard.png)
*Real-time attendance monitoring with live statistics*

### Session History
![Session History](screenshots/session-history.png)
*Complete session history with search and export capabilities*

### Student Portal
![Student Portal](screenshots/student-portal.png)
*Personal dashboard with attendance streaks and statistics*

### Mobile View
![Mobile View](screenshots/mobile-view.png)
*Fully responsive design for mobile devices*

---

## 🚀 Installation

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn
- Git (optional)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/attendance-register.git
   cd attendance-register
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Open browser to `http://localhost:5000`
   - Admin password: `admin123` (change in production!)

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## 📖 Usage

### For Administrators

1. **Login to Admin Dashboard**
   - Navigate to `/admin`
   - Enter password (default: `admin123`)

2. **Start a Session**
   - Toggle the session switch
   - Enter session name (optional)
   - Set late threshold (default: 15 minutes)

3. **Monitor Attendance**
   - View live feed of submissions
   - Check real-time statistics
   - Use search and filters

4. **Export Reports**
   - Choose format (CSV, Excel, PDF, Slides)
   - Download instantly

5. **View History**
   - Click "History" tab
   - Search past sessions
   - Export session data

### For Students

1. **Mark Attendance**
   - Go to `/attendance`
   - Fill in name and student ID
   - Select department
   - Submit

2. **Access Personal Portal**
   - Go to `/student`
   - Register or login
   - View dashboard and history

---

## 🏗️ Project Structure

```
attendance-register/
├── backend/               # Node.js + Express API & services
│   ├── auth/              # Authentication & JWT middleware
│   ├── docs/              # Swagger / OpenAPI documentation
│   ├── modules/           # Domain modules (Academic, Attendance, Audit, RBAC...)
│   ├── services/          # Email, SMS & notification services
│   ├── index.ts           # Server entry point
│   ├── routes.ts          # Central router
│   ├── security.ts        # Comprehensive security middleware
│   ├── storage.ts         # Database access layer
│   └── websocket.ts       # Real-time WebSocket server
│
├── frontend/              # React + Vite frontend application
│   ├── src/
│   │   ├── components/    # UI & feature components
│   │   ├── pages/         # Page routes (Admin, Student, Attendance...)
│   │   ├── hooks/         # Custom React hooks
│   │   ├── context/       # State management context
│   │   └── lib/           # Utility functions & helpers
│   └── public/            # Static client assets
│
├── database/              # SQLite database & Drizzle ORM schemas
│   ├── schema/            # Domain schemas (auth, academic, attendance)
│   ├── db.ts              # SQLite connection instance
│   └── sqlite.db          # Persistent SQLite database
│
├── shared/                # Shared TypeScript types & contracts
├── script/                # Build and administrative utility scripts
│
├── docs/                  # 📚 Documentation & Reports
│   ├── guides/            # Setup, VS Code, GitHub & presentation guides
│   ├── deployment/        # Deployment & Vercel configuration guides
│   ├── architecture/      # Roadmap, security features & change logs
│   ├── reports/           # Pre-deployment test reports
│   └── project-report/    # Academic project report (Chapters 1–8)
│
├── Dockerfile             # Container image specification
├── docker-compose.yml     # Docker multi-service configuration
└── README.md              # Project overview & quick start
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=production
PORT=5000
ADMIN_PASSWORD=your_secure_password
```

### Database

The application uses SQLite for data persistence. The database file (`sqlite.db`) is automatically created on first run.

**Schema includes:**
- `users` - Admin accounts
- `students` - Student accounts
- `sessions` - Attendance sessions
- `attendance_records` - Attendance submissions

---

## 📊 Performance Metrics

- ⚡ **Response Time**: < 1 second (95th percentile)
- 👥 **Concurrent Users**: Supports 500+ simultaneous users
- 💾 **Database Queries**: < 100ms average
- 🔌 **WebSocket Latency**: < 50ms
- 💻 **Memory Usage**: ~380MB
- 🖥️ **CPU Usage**: ~45% under load

---

## 🔒 Security

### Implemented Security Measures

1. **Authentication**
   - Password hashing using SHA-256
   - Session-based authentication
   - Secure password storage

2. **Network Security**
   - Same-network validation
   - IP-based rate limiting
   - CORS configuration

3. **Data Protection**
   - Input validation and sanitization
   - SQL injection prevention (parameterized queries)
   - XSS protection

4. **Access Control**
   - Role-based access (Admin/Student)
   - Session state validation
   - Device claiming mechanism

---

## 🚀 Deployment

### Local Network Deployment

Perfect for schools and colleges:

```bash
npm run build
npm start
```

Access from any device on the network: `http://[server-ip]:5000`

### Cloud Deployment

Deploy to platforms like:
- **Render** (Free tier available)
- **Railway** ($5/month)
- **DigitalOcean** ($6/month)
- **Heroku** ($7/month)

See [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md) for detailed instructions.

---

## 📚 Documentation

Detailed documentation is organized in the [`docs/`](docs/) directory:

- **Guides**:
  - [VS Code Run Guide](docs/guides/HOW_TO_RUN_IN_VSCODE.md)
  - [Step-by-Step GitHub Guide](docs/guides/GITHUB_STEP_BY_STEP.md)
  - [LinkedIn & GitHub Showcase Guide](docs/guides/LINKEDIN_GITHUB_GUIDE.md)
  - [Presentation Guide](docs/guides/PRESENTATION_GUIDE.md)
  - [Implementation Guide](docs/guides/IMPLEMENTATION_GUIDE.md)
  - [Quick Demo Checklist](docs/guides/QUICK_DEMO_CHECKLIST.md)
- **Deployment**:
  - [Production Deployment Guide](docs/deployment/DEPLOYMENT_GUIDE.md)
  - [Vercel Deployment Guide](docs/deployment/VERCEL_DEPLOYMENT.md)
- **Architecture & Security**:
  - [Security Features Deep-Dive](docs/architecture/SECURITY_FEATURES.md)
  - [Feature Roadmap (AAAS)](docs/architecture/AAAS_ROADMAP.md)
  - [Complete Features Summary](docs/architecture/COMPLETE_FEATURES_SUMMARY.md)
- **Reports**:
  - [Pre-Deployment Test Report](docs/reports/PRE_DEPLOYMENT_TEST_REPORT.md)
  - [Consolidated Academic Project Report](docs/project-report/CONSOLIDATED_PROJECT_REPORT.md)

---

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm run test

# Type checking
npm run type-check

# Linting
npm run lint
```

### Test Coverage

- ✅ Unit Tests: 48/48 passed (100%)
- ✅ Integration Tests: All passed
- ✅ Security Tests: All passed
- ✅ Performance Tests: All benchmarks met

---

## 📈 Roadmap

### Planned Features

- [ ] **Mobile Apps** - Native iOS and Android applications
- [ ] **Email Notifications** - Attendance confirmations and alerts
- [ ] **Advanced Analytics** - Predictive analytics and trends
- [ ] **Multi-tenancy** - Support for multiple institutions
- [ ] **LMS Integration** - Integrate with Moodle, Canvas, etc.
- [ ] **Biometric Support** - Optional fingerprint/face recognition
- [ ] **Parent Portal** - View child's attendance
- [ ] **Automated Scheduling** - Schedule sessions in advance
- [ ] **AI Insights** - Attendance pattern analysis
- [ ] **Blockchain** - Immutable attendance records

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Contribution Guidelines

- Follow TypeScript best practices
- Write meaningful commit messages
- Add tests for new features
- Update documentation
- Follow existing code style

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

**[Your Name]**

- LinkedIn: [Your LinkedIn Profile](https://linkedin.com/in/yourprofile)
- GitHub: [@yourusername](https://github.com/yourusername)
- Email: your.email@example.com
- Portfolio: [yourwebsite.com](https://yourwebsite.com)

---

## 🙏 Acknowledgments

- Thanks to all contributors
- Inspired by modern attendance management needs
- Built with amazing open-source technologies
- Special thanks to the React and Node.js communities

---

## 📞 Support

If you have any questions or need help:

- 📧 Email: your.email@example.com
- 💬 Open an [Issue](https://github.com/yourusername/attendance-register/issues)
- 📖 Check the [Documentation](docs/deployment/DEPLOYMENT_GUIDE.md)

---

## ⭐ Show Your Support

If you found this project helpful, please give it a ⭐️!

---

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/yourusername/attendance-register?style=social)
![GitHub forks](https://img.shields.io/github/forks/yourusername/attendance-register?style=social)
![GitHub watchers](https://img.shields.io/github/watchers/yourusername/attendance-register?style=social)

---

<div align="center">

**Made with ❤️ for educational institutions**

[⬆ Back to Top](#attendreg---real-time-attendance-management-system)

</div>
