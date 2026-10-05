# Connecting a real salon (Supabase + Vercel)

You do these steps yourself; nothing here needs a secret key in the code.

1. **Create a Supabase project** (supabase.com, free plan is fine).
2. **Run the database setup:** in the project's SQL Editor, run each file in `supabase/migrations` in date order (all of them; each new milestone may add one).
3. **Add your salon** (SQL Editor), changing the details to yours:
   ```sql
   insert into salon (name, tagline, phone, address, city)
   values ('Awaa Braids', 'Braids done with care, booked in a minute.', '(202) …', 'Your street, City, State', 'Washington, DC area');
   ```
   New salons use US dollars and US Eastern Time. Once you're the admin (step 5), add your styles, stylists and working hours in the app under **Salon**.
4. **Connect the website:** in Vercel (or `.env.local` on your computer) set
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase → Project Settings → API. Only these two public values.
5. **Make yourself the admin:** sign up in the app with your email, then in the SQL Editor:
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
   ```
   Everyone else who signs up is a customer.
