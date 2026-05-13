-- Supabase Storage Setup for Digital Resources
-- Run this in your Supabase SQL Editor after creating the storage bucket

-- Create storage bucket for digital resources (if not created via dashboard)
-- Note: You can create the bucket 'digital-resources' via the Supabase Dashboard Storage section
-- Make sure to set it as public for file access

-- Storage policies for digital-resources bucket
-- Allow anyone to view/download files
CREATE POLICY "Anyone can view digital resources" ON storage.objects
  FOR SELECT USING (bucket_id = 'digital-resources');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload digital resources" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'digital-resources'
    AND auth.role() = 'authenticated'
  );

-- Allow librarians and admins to manage files
CREATE POLICY "Librarians and admins can manage digital resources" ON storage.objects
  FOR ALL USING (
    bucket_id = 'digital-resources'
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('librarian', 'admin')
    )
  );

-- Allow users to delete their own uploaded files (optional)
CREATE POLICY "Users can delete their uploaded resources" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'digital-resources'
    AND EXISTS (
      SELECT 1 FROM digital_resources
      WHERE file_url LIKE '%' || storage.objects.name || '%'
      AND uploaded_by = auth.uid()
    )
  );