-- =============================================
-- CONTENT MANAGER: Add Category Column & 72 Medical Specialty Courses
-- Run this in your Supabase SQL Editor
-- =============================================

-- Step 1: Add category column to courses table
alter table public.courses 
  add column if not exists category text;

-- Step 2: Create index for category filtering
create index if not exists idx_courses_category on public.courses(category);

-- Step 3: Insert all 72 medical specialty courses with categories
-- Delete existing courses if you want to start fresh (OPTIONAL - comment out if you have existing data)
-- DELETE FROM public.courses;

-- CARDIOLOGY GROUP
insert into public.courses (title, description, category) values
('Arthroscopy & Arthroplasty', 'Advanced surgical techniques for joint procedures', 'Orthopedics & Surgery'),
('Clinical Cardiology', 'Comprehensive cardiac care and management', 'Cardiology'),
('Interventional Cardiology', 'Advanced cardiac interventional procedures', 'Cardiology'),
('Pediatric Cardiology', 'Cardiac care for pediatric patients', 'Cardiology'),
('Cardiothoracic and Vascular Surgery', 'Surgical management of heart and vascular conditions', 'Cardiology'),
('Fetal Echocardiography', 'Cardiac imaging for fetal assessment', 'Cardiology'),
('Paediatric Echocardiography', 'Pediatric cardiac ultrasound techniques', 'Cardiology');

-- SURGERY GROUP
insert into public.courses (title, description, category) values
('General Surgery', 'Fundamental surgical principles and techniques', 'Surgery'),
('Neuro Surgery', 'Surgical treatment of neurological conditions', 'Surgery'),
('Orthopedics', 'Musculoskeletal system treatment and surgery', 'Orthopedics & Surgery'),
('Plastic Surgery', 'Reconstructive and aesthetic surgical procedures', 'Surgery'),
('Maxillofacial Surgery', 'Surgery of face, jaw, and oral structures', 'Surgery'),
('Microsurgery', 'Precision surgical techniques using microscopes', 'Surgery'),
('Minimal Access Surgery', 'Minimally invasive surgical approaches', 'Surgery'),
('Minimally Invasive Surgery', 'Advanced laparoscopic and endoscopic techniques', 'Surgery'),
('Paediatric Surgery', 'Surgical care for pediatric patients', 'Surgery'),
('Spine Medicine', 'Non-surgical spine care and management', 'Orthopedics & Surgery'),
('Spinal Cord Surgery', 'Surgical intervention for spinal conditions', 'Surgery'),
('Surgical Oncology', 'Surgical treatment of cancers', 'Oncology'),
('Vascular Surgery', 'Surgery of blood vessels and circulation', 'Surgery');

-- GYNECOLOGY & OBSTETRICS
insert into public.courses (title, description, category) values
('Obstetrics & Gynecology', 'Women''s reproductive health and childbirth', 'Gynecology & Obstetrics'),
('Laparoscopy & Hysteroscopy', 'Minimally invasive gynecological procedures', 'Gynecology & Obstetrics'),
('Reproductive Medicine', 'Fertility treatment and reproductive health', 'Gynecology & Obstetrics'),
('Cosmetic Gynecology', 'Aesthetic gynecological procedures', 'Gynecology & Obstetrics'),
('Fetal Medicine', 'Prenatal diagnosis and fetal treatment', 'Gynecology & Obstetrics'),
('Gyne Oncology', 'Cancer treatment in gynecology', 'Gynecology & Obstetrics'),
('High risk pregnancy', 'Management of complicated pregnancies', 'Gynecology & Obstetrics');

-- PEDIATRICS
insert into public.courses (title, description, category) values
('Pediatrics', 'General pediatric care and child health', 'Pediatrics'),
('Pediatric Neurology', 'Neurological conditions in children', 'Pediatrics'),
('Neonatology', 'Care of newborn infants', 'Pediatrics'),
('Paediatric Endocrionology', 'Endocrine disorders in children', 'Pediatrics');

-- INTERNAL MEDICINE & EMERGENCY
insert into public.courses (title, description, category) values
('Internal Medicine', 'Comprehensive adult medical care', 'Internal Medicine'),
('Family Medicine', 'Primary care for all ages', 'Internal Medicine'),
('Emergency Medicine', 'Acute care and emergency management', 'Emergency & Critical Care'),
('Critical Care', 'Intensive care unit management', 'Emergency & Critical Care');

-- ONCOLOGY
insert into public.courses (title, description, category) values
('Medical Oncology', 'Medical treatment of cancer', 'Oncology'),
('EndoCrine and Breast Onco Surgery', 'Surgical oncology for endocrine and breast', 'Oncology'),
('Head and Neck Oncology', 'Cancer treatment of head and neck', 'Oncology'),
('Oral-Oncology', 'Oral cavity cancer management', 'Oncology');

-- SPECIALTY MEDICINE
insert into public.courses (title, description, category) values
('Dermatology', 'Skin, hair, and nail disorders', 'Specialty Medicine'),
('Diabetology(Diabetes Mellitus)', 'Diabetes management and treatment', 'Specialty Medicine'),
('Gastroenterology', 'Digestive system disorders', 'Specialty Medicine'),
('Nephrology', 'Kidney disease and dialysis', 'Specialty Medicine'),
('Neurology', 'Nervous system disorders', 'Specialty Medicine'),
('Pulmonary Medicine', 'Respiratory system care', 'Specialty Medicine'),
('Rheumatology', 'Autoimmune and joint disorders', 'Specialty Medicine'),
('Endocrinology', 'Hormone and endocrine system disorders', 'Specialty Medicine');

-- RADIOLOGY & IMAGING
insert into public.courses (title, description, category) values
('Radiology', 'Medical imaging and diagnosis', 'Radiology & Imaging'),
('Interventional Neuro Radiology', 'Minimally invasive neurological procedures', 'Radiology & Imaging'),
('Interventional Radiology', 'Image-guided minimally invasive procedures', 'Radiology & Imaging'),
('Neuroradiology', 'Imaging of the nervous system', 'Radiology & Imaging'),
('Musculoskeletal Ultrasound', 'Ultrasound imaging of muscles and joints', 'Radiology & Imaging'),
('USG', 'Ultrasonography techniques', 'Radiology & Imaging'),
('Vascular Ultrasound', 'Ultrasound of blood vessels', 'Radiology & Imaging');

-- OTHER SPECIALTIES
insert into public.courses (title, description, category) values
('Anesthesiology', 'Anesthesia and perioperative care', 'Other Specialties'),
('Cosmetology & Aesthetic Medicine', 'Cosmetic procedures and aesthetic care', 'Other Specialties'),
('Embryology', 'Study of embryonic development', 'Other Specialties'),
('Endourology', 'Minimally invasive urological procedures', 'Other Specialties'),
('Epidemiology', 'Disease patterns and public health', 'Other Specialties'),
('GI Endoscopy', 'Endoscopic procedures of digestive system', 'Other Specialties'),
('Ophthalmology', 'Eye care and surgery', 'Other Specialties'),
('Pain Management', 'Chronic pain treatment and management', 'Other Specialties'),
('Psychiatry', 'Mental health and psychiatric care', 'Other Specialties'),
('Sexology', 'Sexual health and dysfunction', 'Other Specialties'),
('Trichology', 'Hair and scalp disorders', 'Other Specialties'),
('Oral Implantology and Laser Dentistry', 'Advanced dental implant and laser techniques', 'Other Specialties'),
('Upper & GI Neurology', 'Neurological aspects of GI disorders', 'Other Specialties'),
('Urology', 'Urinary system and male reproductive health', 'Other Specialties');

-- =============================================
-- VERIFICATION QUERY
-- =============================================
-- Run this to verify all courses were created with categories:
-- SELECT category, count(*) as course_count 
-- FROM public.courses 
-- GROUP BY category 
-- ORDER BY category;

-- Total count should be 72 courses:
-- SELECT count(*) as total_courses FROM public.courses;
