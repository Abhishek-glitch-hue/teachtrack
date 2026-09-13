@echo off
echo ========================================
echo   TeachTrack - Structured Git Commit
echo ========================================
echo.

REM ===== FRONTEND HTML =====
git add ai_assistant.html
git commit -m "Update AI assistant page"

git add calendar.html
git commit -m "Update calendar page"

git add duties.html
git commit -m "Update duties page"

git add leaves.html
git commit -m "Update leaves page"

git add login.html
git commit -m "Update login page"

git add main.html
git commit -m "Update main dashboard page"

git add message.html
git commit -m "Update messages page"

git add timetable.html
git commit -m "Update timetable page"

git add index.html
git commit -m "Add index page"

git add reset-password.html
git commit -m "Add password reset page"


REM ===== FRONTEND JS / CSS =====
git add assets/app.js
git commit -m "Update frontend application logic"

git add assets/styles.css
git commit -m "Update frontend styles"

git add assets/messages-connections.js
git commit -m "Add message connections"


REM ===== BACKEND PACKAGE =====
git add backend/package.json
git commit -m "Update backend dependencies"

git add backend/package-lock.json
git commit -m "Update backend lockfile"


REM ===== PRISMA SCHEMA =====
git add backend/prisma/schema.prisma
git commit -m "Update Prisma database schema"


REM ===== PRISMA MIGRATIONS =====
git add backend/prisma/migrations/20260906100000_add_leave_history_visibility/
git commit -m "Add leave history visibility migration"

git add backend/prisma/migrations/20260906110000_add_duty_history_visibility/
git commit -m "Add duty history visibility migration"

git add backend/prisma/migrations/20260907110000_add_password_reset_tokens/
git commit -m "Add password reset token migration"

git add backend/prisma/migrations/20260907120000_add_password_reset_tokens/
git commit -m "Add password reset token migration update"

git add backend/prisma/migrations/20260909130000_add_timetable_settings/
git commit -m "Add timetable settings migration"

git add backend/prisma/migrations/20260909140000_add_ai_daily_usage/
git commit -m "Add AI daily usage migration"

git add backend/prisma/migrations/20260910100000_add_message_visibility/
git commit -m "Add message visibility migration"


REM ===== GENERATED PRISMA FILES =====
git add backend/src/generated/prisma/browser.ts
git commit -m "Update generated Prisma browser client"

git add backend/src/generated/prisma/client.ts
git commit -m "Update generated Prisma client"

git add backend/src/generated/prisma/commonInputTypes.ts
git commit -m "Update generated Prisma input types"

git add backend/src/generated/prisma/enums.ts
git commit -m "Update generated Prisma enums"

git add backend/src/generated/prisma/internal/class.ts
git commit -m "Update generated Prisma internal class"

git add backend/src/generated/prisma/internal/prismaNamespace.ts
git commit -m "Update generated Prisma namespace"

git add backend/src/generated/prisma/internal/prismaNamespaceBrowser.ts
git commit -m "Update generated Prisma browser namespace"

git add backend/src/generated/prisma/models.ts
git commit -m "Update generated Prisma models"

git add backend/src/generated/prisma/models/Duty.ts
git commit -m "Update generated Duty model"

git add backend/src/generated/prisma/models/LeaveRequest.ts
git commit -m "Update generated LeaveRequest model"

git add backend/src/generated/prisma/models/Message.ts
git commit -m "Update generated Message model"

git add backend/src/generated/prisma/models/User.ts
git commit -m "Update generated User model"

git add backend/src/generated/prisma/models/AiDailyUsage.ts
git commit -m "Add generated AI daily usage model"

git add backend/src/generated/prisma/models/MessageConnection.ts
git commit -m "Add generated message connection model"

git add backend/src/generated/prisma/models/PasswordResetToken.ts
git commit -m "Add generated password reset token model"

git add backend/src/generated/prisma/models/TimetableSetting.ts
git commit -m "Add generated timetable setting model"


REM ===== BACKEND ROUTES =====
git add backend/src/routes/ai.ts
git commit -m "Update AI route"

git add backend/src/routes/auth.ts
git commit -m "Update authentication route"

git add backend/src/routes/calendar.ts
git commit -m "Update calendar route"

git add backend/src/routes/dashboard.ts
git commit -m "Update dashboard route"

git add backend/src/routes/duties.ts
git commit -m "Update duties route"

git add backend/src/routes/leaves.ts
git commit -m "Update leaves route"

git add backend/src/routes/messages.ts
git commit -m "Update messages route"

git add backend/src/routes/notifications.ts
git commit -m "Update notifications route"

git add backend/src/routes/timetable.ts
git commit -m "Update timetable route"


REM ===== BACKEND LIBRARIES =====
git add backend/src/lib/leaveBalance.ts
git commit -m "Add leave balance utility"

git add backend/src/lib/mailer.ts
git commit -m "Add mailer utility"


REM ===== ENVIRONMENT EXAMPLE =====
git add backend/.env.example
git commit -m "Add backend environment example"


REM ===== FINAL STATUS =====
echo.
echo ========================================
echo   All commits completed
echo ========================================
echo.
git status

echo.
echo ========================================
echo   IMPORTANT: project-dashboard.zip
echo   was intentionally NOT included.
echo ========================================
echo.
pause