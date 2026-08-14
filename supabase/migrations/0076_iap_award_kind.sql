-- Must commit before 0077 can reference 'iap_purchase'.
alter type public.currency_award_kind add value if not exists 'iap_purchase';
