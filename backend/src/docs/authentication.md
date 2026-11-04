# Authentication API

The API returns access and refresh tokens in JSON. Send access tokens as
`Authorization: Bearer <accessToken>`; send refresh tokens only to the refresh and
logout endpoints. This backend does not set cookies, so no cookie or CORS settings
are required for this token flow. Browser clients should keep tokens out of
`localStorage` where possible and use a trusted backend or secure in-memory storage.

Configure `JWT_ACCESS_SECRET` with at least 32 random bytes. The local `.env` is
git-ignored. Defaults are 15 minutes for access tokens and seven days for refresh
tokens. The server validates these settings before startup.

## Requests

Base URL: `http://localhost:3000/api/auth`

### Password login

`POST /login-password`

Customers, agents, and admins use this same endpoint:
```json
{ "email": "user@gmail.com", "password": "StrongPassword123" }
```

Success: **200** with `accessToken`, `refreshToken`, `tokenType`,
`refreshExpiresAt`, and public `user` fields. Passwords are checked against the
stored bcrypt hash; the response includes the account role. Five failed attempts
temporarily lock the account.

Wrong password: **401** `{"error":"Invalid email or password"}`.
Unverified account: **403** `{"error":"Email verification is required"}`.
Locked account: **423**.

### Request login OTP

`POST /login-otp`

```json
{ "email": "user@gmail.com" }
```

Success: **202** `{"message":"If the account is eligible, a login verification code has been queued."}`.
The response is generic and only verified accounts receive mail.

### Verify login OTP

`POST /verify-login-otp`

```json
{ "email": "user@gmail.com", "otp": "123456" }
```

Success: **200** with access token, refresh token, expiry, and public user fields.
Wrong or expired OTP: **400**. Five failed attempts: **429**; the OTP is consumed.

### Refresh tokens

`POST /refresh-token`

```json
{ "refreshToken": "<current-refresh-token>" }
```

Success: **200** with a new access and refresh token. The refresh token is rotated
atomically. An expired or invalid token returns **401**. Reuse of a rotated token
returns **401** and revokes that session family, including its access token.

### Logout current session

`POST /logout`

```json
{ "refreshToken": "<current-refresh-token>" }
```

Success: **200** `{"message":"Session logged out"}`. Its refresh and access tokens
become unusable.

### Logout all devices

`POST /logout-all`

Requires `Authorization: Bearer <accessToken>`. Success: **200**
`{"message":"All sessions logged out"}`. All existing access and refresh tokens
are invalidated.

### Request password-reset OTP

`POST /forgot-password`

```json
{ "email": "user@gmail.com" }
```

Success: **202** `{"message":"If the account is eligible, a password reset code has been queued."}`.
The response does not disclose whether the account exists.

### Verify OTP and reset password

`POST /reset-password`

```json
{
  "email": "user@gmail.com",
  "otp": "123456",
  "newPassword": "NewStrongPassword123"
}
```

Success: **200** `{"message":"Password reset successfully. Please log in again."}`.
Wrong or expired OTP: **400**; five failed attempts: **429**. The reset clears all
sessions and pending login OTPs, so users must log in again.

## Postman verification checklist

1. Password login as customer, agent, and admin via `/login-password`: each returns **200** and the correct role.
2. Password login with an incorrect password: **401**.
3. Password login for an unverified user: **403**.
4. Request login OTP: **202**; response does not disclose account existence.
5. Verify an incorrect OTP: **400**.
6. Verify an expired OTP: **400**.
7. Submit five incorrect OTPs: the fifth returns **429**.
8. Refresh a current refresh token: **200**, both tokens rotate.
9. Refresh an expired token: **401**.
10. Reuse a rotated refresh token: **401** and the session is revoked.
11. Logout with the current refresh token: **200**; token can no longer refresh.
12. Logout all with an access-token Bearer header: **200**; sessions are revoked.
13. Request forgot-password OTP: **202** with a generic response.
14. Reset password with the valid OTP: **200**; all sessions are revoked.
15. Log in with the new password: **200**.
16. Refresh using a token issued before password reset: **401**.
