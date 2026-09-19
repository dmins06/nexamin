# University catalog

`vietnam_universities.csv` is a UTF-8 snapshot of the public institution list
returned by the Ministry of Education and Training admissions portal:

- Source: `https://tuyensinh.moet.gov.vn/ts/Home/Autocomplete?Prefix=`
- Snapshot date: 2026-09-19
- Records: 426 (universities, academies, branches and other admissions units)

`official_code`, `name` and `short_name` are authoritative source fields. Logo, website and email-domain fields are sourced from the institution website. The frontend keeps one local image asset per record for reliable rendering. When an institution does not publish a retrievable favicon, the asset is an accessible code-based seal; it never substitutes an unrelated logo.
