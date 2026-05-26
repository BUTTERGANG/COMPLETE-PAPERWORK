-- Make the paperwork bucket private to prevent unauthorized access via guessed URLs
UPDATE storage.buckets SET public = false WHERE id = 'paperwork';

-- Allow users to delete their own storage files
CREATE POLICY "Users can delete own storage files"
  ON storage.objects FOR DELETE
  USING (auth.uid()::text = (storage.foldername(name))[1]);
