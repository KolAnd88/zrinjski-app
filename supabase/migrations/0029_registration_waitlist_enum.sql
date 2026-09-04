-- 0029_registration_waitlist_enum.sql — nova vrijednost statusa prijave.
--
-- ZASEBNA MIGRACIJA S RAZLOGOM: Postgres ne dopušta da se vrijednost enuma
-- doda i upotrijebi u istoj transakciji. Da je ovo u istoj datoteci s
-- funkcijama koje pišu 'waitlist', pokretanje bi puklo s
-- "unsafe use of new value of enum type". Zato: prvo ovo, pa 0030.

alter type public.registration_status add value if not exists 'waitlist';
