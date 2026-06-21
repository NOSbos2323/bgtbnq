
CREATE POLICY "users upload own receipts" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'deposit-receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users read own receipts" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'deposit-receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
