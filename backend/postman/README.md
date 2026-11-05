# Postman collection

Import both JSON files into Postman:

1. `Ticketing-System.postman_collection.json`
2. `Ticketing-System.local.postman_environment.json`

Select **Ticketing System - Local** as the active environment. Start the backend,
MongoDB, and Redis before sending requests.

## Variables to update first

- `baseUrl`: API address, normally `http://localhost:3000`.
- `adminEmail` and `adminPassword`: seeded administrator credentials.
- `userEmail`, `userPhone`, and `userPassword`: customer test account.
- `agentEmail`, `agentPhone`, and `agentPassword`: agent test account.
- `emailApiKey`: same value as backend `EMAIL_API_KEY`.
- `inboundEmailSecret`: same value as backend `INBOUND_EMAIL_SECRET`.

OTP variables contain examples only. Replace `registrationOtp`, `loginOtp`, or
`resetOtp` with the actual code received by email.

## Recommended manual test order

1. Run **Login Admin with Password**. It saves the admin access token.
2. Create an agent. The response saves `agentId`.
3. Optionally create a category and SLA policy; their IDs save automatically.
4. Register and verify a customer, or use an existing customer.
5. Run **Login Customer with Password**. It saves the customer token and `userId`.
6. Create a customer ticket. It saves `ticketId`.
7. Log in as admin again and assign the ticket to `agentId`.
8. Log in as the agent and run **Request More Information**.
9. Copy `ticket.emailReplyAddress` from that response into `inboundRecipient`.
10. Set a new `inboundMessageId` and run **Simulate Inbound Customer Reply**.

`accessToken` is intentionally shared: each role login replaces it. This makes it
easy to switch between customer, agent, and admin requests.

For reassignment, create another agent and place its ID in `secondAgentId`.
Deleting a category or SLA policy may deactivate it instead when tickets reference
it; that is expected behavior.
