# Awaa Braids

Book braiding appointments from your phone. Customers pick a style, choose a time
that is really free and the salon confirms it; the salon sees its day, the requests
waiting and the week at a glance. Built phone first.

**Try it without any setup:** run it and choose "Continue as Customer" or
"Continue as Salon admin". The demo is a fictional salon with fictional people,
kept in your browser.

## What's in it

- **Front page:** how booking works, styles with prices and times, how to find the salon.
- **Sign in / create an account:** demo accounts, or email and password with a real salon.
- **Customers:** your next appointment, upcoming and past appointments, styles and prices.
- **The salon:** today's diary with each customer's phone number, requests to confirm, the week's bookings and expected income.
- **The database** (`supabase/migrations`): the salon, styles and options, stylists and their hours, time off and appointments, with the security rules below. Booking and cancelling run on the server (`book_appointment`, `cancel_appointment`) so the salon's rules can't be skipped.

- **Booking (milestone 2):** four steps on a phone: a style, then size and length with the price and time adding up as you choose, then a day, any stylist or a favourite and a time that is really free, then review and send. Requests wait for the salon to confirm. Customers can cancel a request any time before it starts, and a confirmed appointment up to 24 hours before; closer than that, the app shows the salon's number.

- **The salon's tools (milestone 3):** tabs Today · Calendar · Salon · Account.
  - Tap any appointment to confirm, decline, move it to another free time or stylist, cancel it, or (once it has started) mark it done or missed.
  - Calendar: each stylist's day (hours, time off, appointments) and the week at a glance.
  - Salon: styles and prices with sizes, lengths and extras (hide a style to stop bookings); stylists with their working week (with breaks) and time off; reports (bookings per week, most booked styles, no-show and cancellation rates, earned and expected).

- **Notifications and polish (milestone 4):**
  - A bell with what's new. The database itself writes a note when an appointment changes: the customer hears when it's confirmed, moved, declined or cancelled by the salon; the salon hears about each new request and each customer cancellation. Customers also see a reminder for anything in the next 24 hours (in the app; no texts or emails are sent).
  - English and Amharic (አማርኛ), including dates and times; switch on the front page, sign-in or Account.
  - An offline banner, "Skip to content", focus kept inside open sheets, and automatic accessibility checks (axe, WCAG 2.1 AA) on every main screen in light and dark mode.

- **Tour and going live (milestone 5):**
  - A one-minute guided tour of the demo (button on the sign-in page): three stops as a customer, then five as the salon, in English or Amharic.
  - `supabase/starter-salon.sql`: the salon, 7 styles with sample prices and one stylist, ready to edit in the app. It refuses to run twice.
  - [docs/setup.md](docs/setup.md): connecting a real salon step by step.

## Security

- Every table has Row Level Security. A customer only ever sees their own profile and appointments; nobody sees another customer's name, phone or bookings.
- Anyone who signs up is a customer. Only the salon (an admin) can make someone an admin.
- Customers can't write appointments directly: booking goes through `book_appointment`, which works out the time and price from the style on the server and checks the hours, notice, booking window, time off and the 30-minute grid. The database itself refuses two open appointments that overlap for the same stylist.
- The website only has the public (anon) key. There is no service-role key anywhere in this app.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 (demo mode without Supabase values)
npm test             # unit tests
npm run test:db      # database security tests (needs PostgreSQL 15+)
npm run test:e2e     # browser tests at phone, tablet and laptop widths
```

To connect a real salon, see [docs/setup.md](docs/setup.md).
