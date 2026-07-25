-- Seed: 35 odobrenih leadov (prenova spletne strani)
-- Source: odobreni_leadi_35_podjetij.xlsx
-- Requires migration: 20260724250000_lead_description.sql
-- owner_id / created_by = first profile (invite yourself first)
-- Safe to re-run (on conflict do nothing).
--
-- Mapping:
--   Ime podjetja          -> company
--   Direktor / poslovodja -> contact
--   E-posta               -> email
--   Spletna stran         -> website
--   Okvirna cena (mid)    -> value
--   Prioriteta            -> tags + probability
--   Status                -> New
--   Everything else       -> description

with owner as (
  select id from public.profiles order by created_at asc nulls last limit 1
)
insert into public.leads (
  id, company, website, contact, email, phone, country,
  category, source, owner_id, status, value, probability,
  first_contact, last_contact, next_follow_up, tags, created_by, description
)
select
  v.id,
  v.company,
  v.website,
  v.contact,
  v.email,
  v.phone,
  v.country,
  v.category,
  v.source,
  o.id,
  v.status,
  v.value,
  v.probability,
  v.first_contact,
  v.last_contact,
  v.next_follow_up,
  v.tags,
  o.id,
  v.description
from owner o
cross join (
  values
  ('l_si_01', 'k.biro d.o.o.', 'https://www.pasivna-gradbena-dela.si/', 'Srečko Križman (poslovodja)', 'sreco.krizman@gmail.com', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Celovita prenova spletne strani za pasivne in lesene hiše: premium predstavitev referenc, ločene storitve, SEO struktura in obrazec za kvalificirano povpraševanje.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Visoka

**Zadnji prihodki**
1.144.685,22 €

**Zadnji čisti dobiček**
306.055,39 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/kbiro-doo/MMxYPAJY'),
  ('l_si_02', 'VEIT TEAM d.o.o.', 'https://www.veitteam.si/sl/', 'Janez Veit; Urška Veit Burja', 'info@veitteam.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2500, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Nova prodajno-servisna platforma: vozila, naročanje servisa, testne vožnje, cenitev škode, kleparstvo in jasni obrazci za posamezne storitve.

**Okvirna cena**
2.000–3.000 €

**Prioriteta**
Visoka

**Zadnji prihodki**
7.732.691,11 €

**Zadnji čisti dobiček**
19.865,03 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/veit-team-doo/MM5cZX3q'),
  ('l_si_03', 'GT PODGORNIK d.o.o.', 'https://www.gtpodgornik.si/', 'Zoran Podgornik; Mei Xin Podgornik', 'info@gtpodgornik.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Prenova strani z močnim portfeljem streh, prenov in zahtevnih objektov; študije projektov, razdelitev storitev ter povpraševanje z možnostjo dodajanja fotografij.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Visoka

**Zadnji prihodki**
1.605.893,84 €

**Zadnji čisti dobiček**
16.891,64 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/gt-podgornik-doo/MMxBcKXC'),
  ('l_si_04', 'ASI – Avtoservis Svetličič d.o.o.', 'https://www.asi.si/', 'David Svetličič', 'info@asi.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2500, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Celovita avtomobilska spletna stran: prodaja in odkup vozil, servisno naročanje, financiranje, poslovalnice ter obrazci za pridobivanje konkretnih povpraševanj.

**Okvirna cena**
2.000–3.000 €

**Prioriteta**
Visoka

**Zadnji prihodki**
5.286.637,32 €

**Zadnji čisti dobiček**
48.700,87 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/asi-doo-idrija/MMGFuIR'),
  ('l_si_05', 'P&A TORKAR d.o.o.', 'https://www.torkar.si/', 'Andraž Torkar', 'andraz@torkar.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Premium arhitekturni portfolio z vizualnimi študijami projektov, filtriranjem referenc, predstavitvijo procesa dela in jasnim povabilom na uvodni sestanek.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
819.343,75 €

**Zadnji čisti dobiček**
1.051,71 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/pa-torkar-doo/MM53RQgD'),
  ('l_si_06', 'ATELJE PRIZMA d.o.o.', 'https://www.atelje-prizma.si/', 'Domen Zalokar (poslovodja)', 'info@atelje-prizma.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Moderna predstavitvena stran za arhitekturni biro: projektne študije, storitve projektiranja in nadzora, reference javnih objektov ter bolj premium vizualna identiteta.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Visoka

**Zadnji prihodki**
433.316,55 €

**Zadnji čisti dobiček**
38.515,79 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/atelje-prizma-doo/MMEzPosY'),
  ('l_si_07', 'STUDIO MODUL d.o.o.', 'https://www.studio-modul.si/', 'Milena Pinezić; Marko Pinezić', 'info.studio.modul@siol.net', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Prenova strukture po potrebah strank: novogradnja, prenova, legalizacija in dovoljenja; reference, razlaga procesa ter obrazec za začetno oceno projekta.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
299.026,18 €

**Zadnji čisti dobiček**
41.961,12 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/studio-modul-doo/MM571vtY'),
  ('l_si_08', 'ELATUS d.o.o. / Klima Elatus', 'https://www.klima-elatus.si/', 'Blaž Lipovec; Branko Omahen', 'elatus.klima@gmail.com', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Prodajno usmerjena stran za klime in ogrevanje: obrazec za okvirno ponudbo, izbira sistema glede na objekt, predstavitev znamk, montaže, servisa in referenc.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
466.180,33 €

**Zadnji čisti dobiček**
16.083,78 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/elatus-doo/MMofPhY'),
  ('l_si_09', 'URANKAR d.o.o.', 'https://www.urankar.si/', 'Tadeja Urankar', 'info@urankar.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
B2B/B2C prenova spletne strani z ločitvijo industrijske opreme od nadstreškov, ograj in konstrukcij; tehnične reference, katalog storitev in obrazec za specifikacijo projekta.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
287.872,78 €

**Zadnji čisti dobiček**
15.688,75 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/urankar-doo/MMxDVY80'),
  ('l_si_10', 'BA-TECH d.o.o.', 'https://www.ba-tech.si/', 'Sebastjan Bašelj', 'info@ba-tech.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Tehnična B2B stran za lasersko navarjanje, graviranje in TIG-varjenje: problemi in rešitve, materiali, stroji, študije primerov ter pošiljanje fotografije ali načrta.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
577.254,36 €

**Zadnji čisti dobiček**
21.732,35 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/ba-tech-doo/MM787YwD'),
  ('l_si_11', 'PURLEN d.o.o.', 'https://www.purlen.si/', 'Vida Jutka Marić', 'info@purlen.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Celovita B2B prenova: sodobna predstavitev izolacijskih sistemov in cevi, tehnična dokumentacija, reference, večjezičnost ter obrazec za pošiljanje specifikacije.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Visoka

**Zadnji prihodki**
2.113.804,03 €

**Zadnji čisti dobiček**
201.791,54 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/purlen-doo/MM1pBVVR'),
  ('l_si_12', 'LINFIS d.o.o.', 'https://www.linfis.si/', 'Borut Fister', 'info@linfis.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Prodajno usmerjena stran za teleskopske viličarje in stroje: katalog nove in rabljene opreme, servis, rezervni deli ter ločeni obrazci za povpraševanje.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Visoka

**Zadnji prihodki**
2.607.587,56 €

**Zadnji čisti dobiček**
147.523,33 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/linfis-doo-ljubljana/MMxqqyeY'),
  ('l_si_13', 'SAMSON KAMNIK d.o.o.', 'https://www.samson-kamnik.si/', 'Nejc Mikuš', 'samson@samson-kamnik.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2150, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Prenova obsežnega produktnega kataloga: jasne kategorije materialov in kemikalij, iskanje, tehnični dokumenti, uporabe izdelkov ter obrazec za B2B povpraševanje.

**Okvirna cena**
1.800–2.500 €

**Prioriteta**
Visoka

**Zadnji prihodki**
2.485.068,04 €

**Zadnji čisti dobiček**
258.638,52 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/samson-kamnik-doo/MME06Ivq'),
  ('l_si_14', 'ŽIMA d.o.o.', 'https://www.zima.si/', 'Marko Ilar', 'info@zima.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2150, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Moderen B2B produktni katalog za čopiče, valjčke, metle in izdelavo po meri; predstavitev proizvodnje, trgovskega programa, distributerjev in povpraševanj.

**Okvirna cena**
1.800–2.500 €

**Prioriteta**
Visoka

**Zadnji prihodki**
2.724.990,64 €

**Zadnji čisti dobiček**
410.153,97 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/zima-doo/MM58i7LC'),
  ('l_si_15', 'N.C.R., Ljubljana, d.o.o. / Hexis', 'https://www.hexis.si/', 'Robert Leskovec; Mateja Oven', 'info@ncr.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2500, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Vizualno močna stran za avtomobilske, zaščitne in arhitekturne folije: jasne rešitve po namenu, galerije izvedb, izobraževanja ter obrazec za svetovanje in ponudbo.

**Okvirna cena**
2.000–3.000 €

**Prioriteta**
Visoka

**Zadnji prihodki**
4.861.034,07 €

**Zadnji čisti dobiček**
137.363,06 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/ncr-ljubljana-doo/MM16XYSY'),
  ('l_si_16', 'OCEAN d.o.o., Kamnik', 'https://www.ocean.si/', 'Marko Ahlin', 'ocean@ocean.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Arhitekturno usmerjena predstavitev šolskega, pisarniškega in predavalniškega pohištva: kolekcije, reference, tehnični podatki in povpraševanja projektantov.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
1.021.157,96 €

**Zadnji čisti dobiček**
10.354,99 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/ocean-doo-kamnik/MM1XsnyC'),
  ('l_si_17', 'TRIO LOG d.o.o.', 'https://www.triolog.si/', 'Ruža Samotorčan', 'info@triolog.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1650, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Preprosta, profesionalna B2B stran za pomorski, letalski in cestni transport, carinjenje ter skladiščenje, z jasnim obrazcem za pridobitev ponudbe.

**Okvirna cena**
1.500–1.800 €

**Prioriteta**
Srednja

**Zadnji prihodki**
1.891.971,48 €

**Zadnji čisti dobiček**
3.774,67 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/trio-log-doo/MMEdZlqY'),
  ('l_si_18', 'EKOTAL d.o.o.', 'https://www.ekotal.si/', 'Mirko Veselič', 'info@ekotal.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
B2B prenova za čiščenje in urejanje okolice: storitve po tipih objektov, reference, prikaz zmogljivosti podjetja ter obrazec za ogled in pripravo ponudbe.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
2.307.199,30 €

**Zadnji čisti dobiček**
1.975,76 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/ekotal-doo/MMo6ovR'),
  ('l_si_19', 'PATENTNA PISARNA d.o.o.', 'https://www.patent.si/', 'Vesna Kovič; Andrej Svetičič (poslovodja)', 'info@patent.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2000, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Kredibilna večjezična strokovna stran: ločene storitve za patente, znamke in modele, profili zastopnikov, vsebinski center ter obrazec za začetno presojo primera.

**Okvirna cena**
1.700–2.300 €

**Prioriteta**
Srednja

**Zadnji prihodki**
1.998.968,14 €

**Zadnji čisti dobiček**
-98.180,89 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/patentna-pisarna-doo/MM1cjO20'),
  ('l_si_20', 'TEKNOXGROUP SLOVENIJA d.o.o.', 'https://www.teknoxgroup.com/si/domov/', 'Tomaž Pogačnik', 'contact-si@teknoxgroup.com', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2500, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Prenova slovenske B2B predstavitve: preglednejši katalog strojev in rešitev, rabljena oprema, najem, servis, rezervni deli ter obrazci za konkretna prodajna povpraševanja.

**Okvirna cena**
2.000–3.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
16.944.133,00 €

**Zadnji čisti dobiček**
476.153,00 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/teknoxgroup-slovenija-doo/MMEXbzOY'),
  ('l_si_21', 'LEO TRADE d.o.o., Ljubljana', 'https://www.leotrade.si/', 'Borut Potočnik; Aleš Bučar', 'leo-trade@siol.net', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1650, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Profesionalna B2B transportna stran: jasna predstavitev relacij, vrst prevozov in voznega parka, prednosti podjetja ter kratek obrazec za pripravo ponudbe.

**Okvirna cena**
1.500–1.800 €

**Prioriteta**
Srednja

**Zadnji prihodki**
2.255.290,70 €

**Zadnji čisti dobiček**
6.118,24 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/leo-trade-doo-ljubljana/MM5WfkBY'),
  ('l_si_22', 'MIHEVC TRANSPORT d.o.o.', 'https://mihevc-transport.si/', 'Franci Mihevc', 'info@mihevc-transport.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1650, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Prenova transportne strani z boljšo predstavitvijo domačih in mednarodnih prevozov, voznega parka, relacij, referenc ter obrazcem za hitro povpraševanje.

**Okvirna cena**
1.500–1.800 €

**Prioriteta**
Srednja

**Zadnji prihodki**
1.875.058,89 €

**Zadnji čisti dobiček**
3.156,81 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/mihevc-transport-doo/MM5XqfcC'),
  ('l_si_23', 'ESO INŽENIRING d.o.o.', 'https://eso-inzeniring.si/', 'Borut Medved', 'borut.medved@eso.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Prodajno usmerjena stran za energetske sanacije, fotovoltaiko in solarne sisteme: storitve po tipih objektov, reference, subvencije ter obrazec za začetno oceno projekta.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
540.394,02 €

**Zadnji čisti dobiček**
11.719,08 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/eso-inzeniring-doo/MMsvzrY'),
  ('l_si_24', 'PICHLER & CO d.o.o.', 'https://www.pichler.si/', 'Rebeka Prodanovič', 'pichler@pichler-co.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2000, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Preglednejša B2B stran in katalog prezračevalnih sistemov: rešitve po tipu objekta, produktne kategorije, tehnični dokumenti, ceniki in kvalificirana povpraševanja.

**Okvirna cena**
1.700–2.300 €

**Prioriteta**
Visoka

**Zadnji prihodki**
1.321.595,76 €

**Zadnji čisti dobiček**
102.815,10 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/pichler--co-doo/MM1fRIjY'),
  ('l_si_25', 'SCC d.o.o.', 'https://www.scc.si/', 'Miha Zadnik', 'info@scc.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Prenova B2B predstavitve industrijskih kemikalij, distribucije in tehničnega blaga: jasni programi, področja uporabe, dokumentacija ter obrazci za vzorce in ponudbe.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
645.861,22 €

**Zadnji čisti dobiček**
2.056,63 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/scc-doo/MME1PFlC'),
  ('l_si_26', 'P.S.T. d.o.o.', 'https://www.pst.si/', 'Dejan Pešl', 'info@pst.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2000, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Industrijska spletna predstavitev proizvodnje in zmogljivosti: tehnologije, izdelki, materiali, certifikati, reference ter obrazec za pošiljanje tehnične specifikacije.

**Okvirna cena**
1.700–2.300 €

**Prioriteta**
Srednja

**Zadnji prihodki**
1.909.961,78 €

**Zadnji čisti dobiček**
7.121,85 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/pst-doo/MM1b69uR'),
  ('l_si_27', 'AHIL PLASTIKA d.o.o.', 'https://www.plastika.ahil.si/', 'Aleš Hudoklin', 'ales@ahil.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2150, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Dvojezična B2B spletna stran za brizganje plastike: razvoj izdelkov, strojni park, laboratorij, kontrola kakovosti, industrije in RFQ-obrazec za pošiljanje načrtov.

**Okvirna cena**
1.800–2.500 €

**Prioriteta**
Visoka

**Zadnji prihodki**
2.236.400,25 €

**Zadnji čisti dobiček**
324.592,17 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/ahil-plastika-doo/MM5BJ5IC'),
  ('l_si_28', 'BE-MONT d.o.o.', 'https://www.be-mont.si/', 'Jure Berce', 'info@be-mont.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Industrijska lead-generation stran za CNC-obdelavo in montažo: strojni park, materiali, tolerance, galerija izdelkov in obrazec za pošiljanje tehnične dokumentacije.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Srednja

**Zadnji prihodki**
987.742,12 €

**Zadnji čisti dobiček**
3.248,65 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/be-mont-doo/MM2vonD'),
  ('l_si_29', 'KOVINOPLASTIKA LOZAR d.o.o.', 'https://www.kovinoplastika-lozar.si/', 'Matjaž Lozar', 'info@kovinoplastika-lozar.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1900, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Tehnična B2B stran za brizganje plastike: strojni park, materiali, industrije, razvoj izdelka, kontrola kakovosti, sodoben katalog in obrazec za pošiljanje načrta.

**Okvirna cena**
1.600–2.200 €

**Prioriteta**
Visoka

**Zadnji prihodki**
1.505.612,90 €

**Zadnji čisti dobiček**
84.907,95 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/kovinoplastika-lozar-doo/MMxDdi7C

**Opombe**
Zadnji javno dostopni finančni podatki so za leto 2024.'),
  ('l_si_30', 'TTIJ d.o.o., Jesenice', 'https://www.ttij.si/', 'Matevž Drole Marolt', 'info@ttij.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2000, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Večjezična industrijska stran s preglednim katalogom metalurških in ognjevzdržnih proizvodov, materiali, certifikati, izvoznimi trgi in tehničnim povpraševanjem.

**Okvirna cena**
1.700–2.300 €

**Prioriteta**
Visoka

**Zadnji prihodki**
1.101.260,94 €

**Zadnji čisti dobiček**
68.907,58 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/ttij-doo-jesenice/MM52vJ9Y

**Opombe**
Zadnji javno dostopni finančni podatki so za leto 2024.'),
  ('l_si_31', 'DIHTA d.o.o.', 'https://www.dihta.si/', 'Jan Ilovar; Elvir Lulić', 'info@dihta.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2150, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Prenova B2B-kataloga tesnil: iskanje po materialu, dimenziji in industriji, izdelava po meri, tehnična dokumentacija ter hiter obrazec za povpraševanje.

**Okvirna cena**
1.800–2.500 €

**Prioriteta**
Visoka

**Zadnji prihodki**
1.636.012,00 €

**Zadnji čisti dobiček**
125.963,46 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/dihta-doo/MM5ITNJR'),
  ('l_si_32', 'OBLIKOVINA-BIRO LINE d.o.o.', 'https://www.oblikovina.si/', 'Marjana Pavlič', 'info@oblikovina-bl.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1700, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Vizualni portfolio POS-stojal in izdelkov po meri, razdelitev po materialih in namenih, laserski razrez, brizganje plastike ter obrazec za pripravo ponudbe.

**Okvirna cena**
1.500–1.900 €

**Prioriteta**
Srednja

**Zadnji prihodki**
542.068,44 €

**Zadnji čisti dobiček**
11.236,95 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/oblikovina-biro-line-doo-domzale/MM1XccjY'),
  ('l_si_33', 'COSTON d.o.o. Ljubljana', 'https://www.coston.si/', 'Darjan Avsec', 'coston@siol.net', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1750, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Premium vizualna stran za terazzo, brušene betone, stopnice in arhitekturne elemente; reference po tipih objektov in obrazec za projektno povpraševanje.

**Okvirna cena**
1.500–2.000 €

**Prioriteta**
Visoka

**Zadnji prihodki**
1.015.956,61 €

**Zadnji čisti dobiček**
5.187,39 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/coston-doo-ljubljana/MM5HyB7q'),
  ('l_si_34', 'ABN d.o.o., Celje', 'https://www.abn.si/', 'Janez Nosan', 'info@abn.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 2000, 40, null::date, null::date, null::date, array['si-leads', 'priority-high']::text[], '**Predlagana storitev**
Tehnična B2B stran za membranske in termične sisteme: rešitve po industrijah, procesi, reference, dokumentacija in obrazec za pošiljanje specifikacije.

**Okvirna cena**
1.700–2.300 €

**Prioriteta**
Visoka

**Zadnji prihodki**
722.487,06 €

**Zadnji čisti dobiček**
158.941,86 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/abn-doo-celje/MMae7C'),
  ('l_si_35', 'LESOM d.o.o., Ljubljana', 'https://www.lesom.si/', 'Igor Pleško', 'info@lesom.si', '', 'Slovenia', 'Local business', 'Cold email', 'New', 1650, 25, null::date, null::date, null::date, array['si-leads', 'priority-medium']::text[], '**Predlagana storitev**
Ločena predstavitev prodaje strojev, lastne kovinske proizvodnje in servisa; katalog znamk, strojni park, konkretne reference in servisna povpraševanja.

**Okvirna cena**
1.500–1.800 €

**Prioriteta**
Srednja

**Zadnji prihodki**
456.153,58 €

**Zadnji čisti dobiček**
5.922,38 €

**Vir finančnih podatkov**
https://www.companywall.si/podjetje/lesom-doo-ljubljana/MMxpjeZY')
) as v(
  id, company, website, contact, email, phone, country,
  category, source, status, value, probability,
  first_contact, last_contact, next_follow_up, tags, description
)
on conflict (id) do nothing;
