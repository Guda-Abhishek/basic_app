# TODO: Remove Password Hashing and Simplify Login

## Steps to Complete
- [x] Remove bcrypt import from backend/routes/authRoutes.js
- [x] Modify registration endpoint to store plain text password instead of hashed
- [x] Modify login endpoint to compare plain text passwords directly
- [x] Modify backend login endpoint to remove JWT generation, return user data directly
- [x] Update frontend LoginScreen to store user data without tokens and navigate to HomeScreen
- [ ] Test login functionality

## Notes
- This is a temporary change for development/testing purposes.
- Ensure to re-implement hashing and JWT before deploying to production.
