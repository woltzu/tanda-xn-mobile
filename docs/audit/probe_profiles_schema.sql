SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='profiles'
   AND column_name IN ('avatar_url','photo_url','locale','language','city','country',
                       'full_name','name','phone','email','timezone','date_of_birth',
                       'preferred_language','round_up_increment','tax_id')
 ORDER BY column_name;
