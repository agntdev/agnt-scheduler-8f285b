# Professional Service Booking Bot — Bot specification

**Archetype:** booking

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot enabling customers to view services, auto-assign or select providers, schedule one-off or recurring appointments, and pay up-front within the bot. Supports booking management, payment processing, and real-time notifications for owners/admins.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- customers
- partners
- clients

## Success criteria

- Completed bookings with up-front payment
- Real-time booking notifications to owner/admin
- Recurring appointment scheduling with auto-assignment

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with booking options
- **Book service** (button, actor: user, callback: booking:start) — Initiate service selection and scheduling flow
- **My bookings** (button, actor: user, callback: booking:manage) — View and manage existing bookings
- **Contact** (button, actor: user, callback: contact:form) — Open support/contact form

## Flows

### booking_flow
_Trigger:_ /start with 'Book service' selection

1. Service selection
2. Date/time slot choice
3. Provider selection or auto-assignment
4. Recurring pattern selection
5. Payment processing
6. Confirmation delivery

_Data touched:_ User, Service, Provider, Booking, Payment

### booking_management
_Trigger:_ My bookings button

1. Display active bookings
2. Reschedule option with policy validation
3. Cancel option with refund calculation
4. Receipt generation

_Data touched:_ Booking, Payment

### admin_notifications
_Trigger:_ New/updated booking

1. Generate notification payload
2. Send to owner DM
3. Send to admin group if configured

_Data touched:_ Notification

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

- **User** _(retention: persistent)_ — Customer/partner profile
  - fields: telegram_id, name, timezone, notification_prefs
- **Service** _(retention: persistent)_ — Available service offerings
  - fields: name, duration, price, description, availability_rules
- **Provider** _(retention: persistent)_ — Service provider/staff
  - fields: name, working_hours, services_offered, buffer_times, timezone
- **Booking** _(retention: persistent)_ — Scheduled appointment
  - fields: service_id, provider_id, start_time, end_time, recurrence, status, payment_status
- **Payment** _(retention: persistent)_ — Transaction records
  - fields: amount, currency, status, transaction_id
- **Notification** _(retention: session)_ — System alerts
  - fields: recipient_id, message, timestamp, read_status

## Integrations

- **Telegram** (required) — Bot API messaging
- **Telegram Payments** (required) — In-app card payment processing
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Configure services and providers
- Set cancellation/refund policies
- Manage admin notification groups

## Notifications

- New booking alerts
- Rescheduling alerts
- Payment confirmation alerts

## Permissions & privacy

- User data encrypted at rest
- Payment data handled via Telegram's secure API
- User consent required for admin group notifications

## Edge cases

- Payment failures during booking
- Timezone conversion errors
- Provider unavailability during recurrence

## Required tests

- End-to-end booking flow with payment
- Recurring appointment generation
- Cancellation policy enforcement

## Assumptions

- Default 24-hour refund policy applies
- Auto-assignment picks first available provider
- Telegram payments API is available in user's region
