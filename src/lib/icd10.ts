export type ICD10Code = { code: string; description: string; category: string };

export const ICD10_CODES: ICD10Code[] = [
  // ─── Infections ──────────────────────────────────────────────────────────────
  { code: "A09",   description: "Infectious gastroenteritis and colitis",               category: "Infections" },
  { code: "A15.0", description: "Tuberculosis of lung",                                 category: "Infections" },
  { code: "A37.0", description: "Whooping cough due to Bordetella pertussis",           category: "Infections" },
  { code: "A41.9", description: "Sepsis, unspecified",                                  category: "Infections" },
  { code: "B00.9", description: "Herpesviral infection, unspecified",                   category: "Infections" },
  { code: "B02.9", description: "Zoster (shingles), unspecified",                       category: "Infections" },
  { code: "B34.9", description: "Viral infection, unspecified",                         category: "Infections" },
  { code: "B37.0", description: "Candidal stomatitis (oral thrush)",                    category: "Infections" },

  // ─── Upper Respiratory ───────────────────────────────────────────────────────
  { code: "J00",   description: "Acute nasopharyngitis (common cold)",                  category: "Respiratory" },
  { code: "J01.9", description: "Acute sinusitis, unspecified",                         category: "Respiratory" },
  { code: "J02.9", description: "Acute pharyngitis, unspecified",                       category: "Respiratory" },
  { code: "J03.9", description: "Acute tonsillitis, unspecified",                       category: "Respiratory" },
  { code: "J04.0", description: "Acute laryngitis",                                     category: "Respiratory" },
  { code: "J04.1", description: "Acute tracheitis",                                     category: "Respiratory" },
  { code: "J06.9", description: "Acute upper respiratory infection, unspecified",       category: "Respiratory" },
  { code: "J30.9", description: "Allergic rhinitis, unspecified",                       category: "Respiratory" },
  { code: "J32.0", description: "Chronic maxillary sinusitis",                          category: "Respiratory" },
  { code: "J35.0", description: "Chronic tonsillitis",                                  category: "Respiratory" },

  // ─── Lower Respiratory ───────────────────────────────────────────────────────
  { code: "J18.9", description: "Pneumonia, unspecified",                               category: "Respiratory" },
  { code: "J20.9", description: "Acute bronchitis, unspecified",                        category: "Respiratory" },
  { code: "J21.9", description: "Acute bronchiolitis, unspecified",                     category: "Respiratory" },
  { code: "J22",   description: "Acute lower respiratory infection, unspecified",       category: "Respiratory" },
  { code: "J44.1", description: "COPD with acute exacerbation",                         category: "Respiratory" },
  { code: "J45.9", description: "Asthma, unspecified",                                  category: "Respiratory" },
  { code: "J45.2", description: "Mild intermittent asthma",                             category: "Respiratory" },
  { code: "J45.3", description: "Mild persistent asthma",                               category: "Respiratory" },
  { code: "J45.4", description: "Moderate persistent asthma",                           category: "Respiratory" },

  // ─── Cardiovascular ──────────────────────────────────────────────────────────
  { code: "I10",   description: "Essential (primary) hypertension",                     category: "Cardiovascular" },
  { code: "I11.9", description: "Hypertensive heart disease without heart failure",     category: "Cardiovascular" },
  { code: "I20.9", description: "Angina pectoris, unspecified",                         category: "Cardiovascular" },
  { code: "I21.9", description: "Acute myocardial infarction, unspecified",             category: "Cardiovascular" },
  { code: "I25.1", description: "Atherosclerotic heart disease of native coronary artery", category: "Cardiovascular" },
  { code: "I48.0", description: "Paroxysmal atrial fibrillation",                       category: "Cardiovascular" },
  { code: "I48.2", description: "Chronic atrial fibrillation",                          category: "Cardiovascular" },
  { code: "I50.9", description: "Heart failure, unspecified",                           category: "Cardiovascular" },
  { code: "I63.9", description: "Cerebral infarction, unspecified",                     category: "Cardiovascular" },
  { code: "I64",   description: "Stroke, not specified as haemorrhage or infarction",   category: "Cardiovascular" },
  { code: "I73.9", description: "Peripheral vascular disease, unspecified",             category: "Cardiovascular" },
  { code: "I83.9", description: "Varicose veins of lower extremities, unspecified",     category: "Cardiovascular" },

  // ─── Gastrointestinal ────────────────────────────────────────────────────────
  { code: "K05.0", description: "Acute gingivitis",                                     category: "Gastrointestinal" },
  { code: "K21.0", description: "Gastro-oesophageal reflux disease with oesophagitis", category: "Gastrointestinal" },
  { code: "K21.9", description: "Gastro-oesophageal reflux disease without oesophagitis", category: "Gastrointestinal" },
  { code: "K25.9", description: "Gastric ulcer, unspecified",                           category: "Gastrointestinal" },
  { code: "K26.9", description: "Duodenal ulcer, unspecified",                          category: "Gastrointestinal" },
  { code: "K29.7", description: "Gastritis, unspecified",                               category: "Gastrointestinal" },
  { code: "K35.8", description: "Acute appendicitis without peritonitis",               category: "Gastrointestinal" },
  { code: "K40.9", description: "Inguinal hernia without obstruction or gangrene",      category: "Gastrointestinal" },
  { code: "K57.3", description: "Diverticulosis of large intestine without perforation", category: "Gastrointestinal" },
  { code: "K58.9", description: "Irritable bowel syndrome without diarrhoea",           category: "Gastrointestinal" },
  { code: "K59.0", description: "Constipation, unspecified",                            category: "Gastrointestinal" },
  { code: "K59.1", description: "Functional diarrhoea",                                 category: "Gastrointestinal" },
  { code: "K74.6", description: "Cirrhosis of liver, unspecified",                      category: "Gastrointestinal" },
  { code: "K80.1", description: "Calculus of gallbladder with other cholecystitis",     category: "Gastrointestinal" },

  // ─── Diabetes & Endocrine ────────────────────────────────────────────────────
  { code: "E10.9", description: "Type 1 diabetes mellitus without complications",       category: "Endocrine" },
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications",       category: "Endocrine" },
  { code: "E11.0", description: "Type 2 diabetes mellitus with hyperosmolarity",        category: "Endocrine" },
  { code: "E11.6", description: "Type 2 diabetes mellitus with other specified complications", category: "Endocrine" },
  { code: "E03.9", description: "Hypothyroidism, unspecified",                          category: "Endocrine" },
  { code: "E05.9", description: "Thyrotoxicosis, unspecified",                          category: "Endocrine" },
  { code: "E11.3", description: "Type 2 diabetes mellitus with ophthalmic complications", category: "Endocrine" },
  { code: "E11.4", description: "Type 2 diabetes mellitus with neurological complications", category: "Endocrine" },
  { code: "E66.0", description: "Obesity due to excess calories",                       category: "Endocrine" },
  { code: "E78.0", description: "Pure hypercholesterolaemia",                           category: "Endocrine" },
  { code: "E78.5", description: "Hyperlipidaemia, unspecified",                         category: "Endocrine" },

  // ─── Musculoskeletal ─────────────────────────────────────────────────────────
  { code: "M06.9", description: "Rheumatoid arthritis, unspecified",                    category: "Musculoskeletal" },
  { code: "M10.9", description: "Gout, unspecified",                                    category: "Musculoskeletal" },
  { code: "M17.9", description: "Osteoarthritis of knee, unspecified",                  category: "Musculoskeletal" },
  { code: "M19.9", description: "Osteoarthritis, unspecified",                          category: "Musculoskeletal" },
  { code: "M25.5", description: "Pain in joint",                                        category: "Musculoskeletal" },
  { code: "M47.8", description: "Other spondylosis",                                    category: "Musculoskeletal" },
  { code: "M48.0", description: "Spinal stenosis",                                      category: "Musculoskeletal" },
  { code: "M54.2", description: "Cervicalgia (neck pain)",                              category: "Musculoskeletal" },
  { code: "M54.5", description: "Low back pain",                                        category: "Musculoskeletal" },
  { code: "M54.4", description: "Lumbago with sciatica",                                category: "Musculoskeletal" },
  { code: "M75.1", description: "Rotator cuff syndrome",                                category: "Musculoskeletal" },
  { code: "M79.3", description: "Panniculitis",                                         category: "Musculoskeletal" },
  { code: "M80.0", description: "Postmenopausal osteoporosis with fracture",            category: "Musculoskeletal" },
  { code: "M81.0", description: "Postmenopausal osteoporosis without fracture",         category: "Musculoskeletal" },

  // ─── Neurological ────────────────────────────────────────────────────────────
  { code: "G20",   description: "Parkinson disease",                                    category: "Neurological" },
  { code: "G35",   description: "Multiple sclerosis",                                   category: "Neurological" },
  { code: "G40.9", description: "Epilepsy, unspecified",                                category: "Neurological" },
  { code: "G43.9", description: "Migraine, unspecified",                                category: "Neurological" },
  { code: "G44.2", description: "Tension-type headache",                                category: "Neurological" },
  { code: "G45.9", description: "Transient cerebral ischaemic attack, unspecified",     category: "Neurological" },
  { code: "G47.0", description: "Insomnia",                                             category: "Neurological" },
  { code: "G47.3", description: "Sleep apnoea",                                         category: "Neurological" },
  { code: "G62.9", description: "Polyneuropathy, unspecified",                          category: "Neurological" },

  // ─── Mental Health ───────────────────────────────────────────────────────────
  { code: "F10.1", description: "Mental and behavioural disorders due to alcohol use",  category: "Mental Health" },
  { code: "F20.9", description: "Schizophrenia, unspecified",                           category: "Mental Health" },
  { code: "F32.9", description: "Depressive episode, unspecified",                      category: "Mental Health" },
  { code: "F33.9", description: "Recurrent depressive disorder, unspecified",           category: "Mental Health" },
  { code: "F40.1", description: "Social phobias",                                       category: "Mental Health" },
  { code: "F41.0", description: "Panic disorder",                                       category: "Mental Health" },
  { code: "F41.1", description: "Generalised anxiety disorder",                         category: "Mental Health" },
  { code: "F41.9", description: "Anxiety disorder, unspecified",                        category: "Mental Health" },
  { code: "F43.1", description: "Post-traumatic stress disorder",                       category: "Mental Health" },
  { code: "F43.2", description: "Adjustment disorder",                                  category: "Mental Health" },
  { code: "F50.0", description: "Anorexia nervosa",                                     category: "Mental Health" },

  // ─── Genitourinary ───────────────────────────────────────────────────────────
  { code: "N10",   description: "Acute pyelonephritis",                                 category: "Genitourinary" },
  { code: "N17.9", description: "Acute kidney failure, unspecified",                    category: "Genitourinary" },
  { code: "N18.3", description: "Chronic kidney disease, stage 3",                      category: "Genitourinary" },
  { code: "N18.9", description: "Chronic kidney disease, unspecified",                  category: "Genitourinary" },
  { code: "N20.0", description: "Calculus of kidney",                                   category: "Genitourinary" },
  { code: "N30.0", description: "Acute cystitis",                                       category: "Genitourinary" },
  { code: "N39.0", description: "Urinary tract infection, unspecified",                 category: "Genitourinary" },
  { code: "N40",   description: "Benign prostatic hyperplasia",                         category: "Genitourinary" },
  { code: "N76.0", description: "Acute vaginitis",                                      category: "Genitourinary" },
  { code: "N92.0", description: "Excessive menstruation",                               category: "Genitourinary" },

  // ─── Skin ────────────────────────────────────────────────────────────────────
  { code: "L20.9", description: "Atopic dermatitis, unspecified",                       category: "Skin" },
  { code: "L23.9", description: "Allergic contact dermatitis, unspecified cause",       category: "Skin" },
  { code: "L30.9", description: "Dermatitis, unspecified",                              category: "Skin" },
  { code: "L40.0", description: "Psoriasis vulgaris",                                   category: "Skin" },
  { code: "L50.9", description: "Urticaria, unspecified",                               category: "Skin" },
  { code: "L60.0", description: "Ingrown nail",                                         category: "Skin" },
  { code: "L70.0", description: "Acne vulgaris",                                        category: "Skin" },

  // ─── Eye & ENT ───────────────────────────────────────────────────────────────
  { code: "H01.0", description: "Blepharitis",                                          category: "Eye & ENT" },
  { code: "H10.9", description: "Conjunctivitis, unspecified",                          category: "Eye & ENT" },
  { code: "H25.9", description: "Cataract, unspecified",                                category: "Eye & ENT" },
  { code: "H40.9", description: "Glaucoma, unspecified",                                category: "Eye & ENT" },
  { code: "H52.1", description: "Myopia",                                               category: "Eye & ENT" },
  { code: "H52.4", description: "Presbyopia",                                           category: "Eye & ENT" },
  { code: "H60.9", description: "Otitis externa, unspecified",                          category: "Eye & ENT" },
  { code: "H65.9", description: "Nonsuppurative otitis media, unspecified",             category: "Eye & ENT" },
  { code: "H66.9", description: "Suppurative otitis media, unspecified",                category: "Eye & ENT" },
  { code: "H81.1", description: "Benign paroxysmal vertigo",                            category: "Eye & ENT" },

  // ─── Symptoms / Signs ────────────────────────────────────────────────────────
  { code: "R00.0", description: "Tachycardia, unspecified",                             category: "Symptoms" },
  { code: "R05",   description: "Cough",                                                category: "Symptoms" },
  { code: "R06.0", description: "Dyspnoea (shortness of breath)",                       category: "Symptoms" },
  { code: "R07.9", description: "Chest pain, unspecified",                              category: "Symptoms" },
  { code: "R10.0", description: "Acute abdomen",                                        category: "Symptoms" },
  { code: "R10.4", description: "Other and unspecified abdominal pain",                 category: "Symptoms" },
  { code: "R11",   description: "Nausea and vomiting",                                  category: "Symptoms" },
  { code: "R17",   description: "Unspecified jaundice",                                 category: "Symptoms" },
  { code: "R19.7", description: "Diarrhoea, unspecified",                               category: "Symptoms" },
  { code: "R50.9", description: "Fever, unspecified",                                   category: "Symptoms" },
  { code: "R51",   description: "Headache",                                             category: "Symptoms" },
  { code: "R53",   description: "Malaise and fatigue",                                  category: "Symptoms" },
  { code: "R55",   description: "Syncope and collapse",                                 category: "Symptoms" },
  { code: "R60.0", description: "Localised oedema",                                     category: "Symptoms" },
  { code: "R73.0", description: "Abnormal glucose tolerance test",                      category: "Symptoms" },

  // ─── Injuries ────────────────────────────────────────────────────────────────
  { code: "S09.9", description: "Unspecified injury of head",                           category: "Injuries" },
  { code: "S62.5", description: "Fracture of thumb",                                    category: "Injuries" },
  { code: "S82.9", description: "Fracture of leg, unspecified",                         category: "Injuries" },
  { code: "T14.0", description: "Superficial injury of unspecified body region",        category: "Injuries" },
  { code: "T14.1", description: "Open wound of unspecified body region",                category: "Injuries" },
  { code: "T14.9", description: "Injury, unspecified",                                  category: "Injuries" },

  // ─── Preventive / Z-codes ────────────────────────────────────────────────────
  { code: "Z00.0", description: "General examination without complaint",                category: "Preventive" },
  { code: "Z00.1", description: "Routine child health examination",                     category: "Preventive" },
  { code: "Z12.1", description: "Screening examination for intestinal tumours",         category: "Preventive" },
  { code: "Z23",   description: "Immunisation against single bacterial diseases",       category: "Preventive" },
  { code: "Z30.0", description: "Contraception counselling",                            category: "Preventive" },
  { code: "Z34",   description: "Supervision of normal pregnancy",                      category: "Preventive" },
  { code: "Z51.1", description: "Chemotherapy session for neoplasm",                    category: "Preventive" },
  { code: "Z71.0", description: "Persons consulting health care for advice",            category: "Preventive" },
  { code: "Z76.0", description: "Issue of repeat prescription",                         category: "Preventive" },
];

export function searchICD10(query: string): ICD10Code[] {
  if (!query || query.trim().length < 2) return [];
  const q = query.toLowerCase().trim();
  return ICD10_CODES.filter(
    (c) => c.code.toLowerCase().startsWith(q) || c.description.toLowerCase().includes(q)
  ).slice(0, 12);
}
