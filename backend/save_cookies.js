const db = require('./db');

const cookies = {
  'im_iss'       : 't%3DeyJhbGciOiJzaGEyNTYiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiI5KjYqNSo0KjMqIiwiY2R0IjoiMjItMDUtMjAyNiIsImV4cCI6MTc3OTUzNzUzMiwiaWF0IjoxNzc5NDUxMTMyLCJpc3MiOiJVU0VSIiwic3ViIjoxNDI3M190cnVuY2F0ZWQifQ.oylYdZCLi5kRaAXZpZfkU_TktyW-_Cdzz_xZrkQYwpo',
  'ImeshVisitor' : 'SubUser%3D%7Cadmln%3D0%7Cadmsales%3D0%7Ccd%3D22%2FMAY%2F2026%7Ccmid%3D48%7Cctid%3D70625%7Cem%3Da%2A%2A%2A%2A%2A%2A%2A%2A%40gmail.com%7Ceotp%3D%7Cev%3DV%7Cfn%3DRAHUL%7Cglid%3D142735335%7Ciso%3DIN%7Cmb1%3D9860514336%7Cphcc%3D91%7Custs%3D%7Cutyp%3DP%7Cuv%3DV',
  'Lda_aKUr6BGRn': 'hipodi.com/r/v2?',
  'Lda_aKUr6BGRr': '0',
  'LGNSTR'       : '0%2C2%2C0%2C1%2C1%2C1%2C1%2C0%2C1',
  'MUID'         : '2F1B2DF3FA0468E13F813AAEFB4069F4',
  'pop_mthd'     : 'FL%3D0%7CDTy%3D1',
  'receive-cookie-deprecation': '1',
  'sessid'       : 'spv=11',
  'user_choice_loc': '',
  'userDet'      : 'glid=142735335|loc_pref=3|fcp_flag=1|image=http://5.imimg.com/data5/ANDROID/GlPhoto/2023/3/294953594/NA/YH/ZW/142735335/myprofile-jpeg-64x64.jpg|service_ids=353,271,350,236,233,280|logo=https://5.imimg.com/data5/SELLER/Logo/2023/4/301589916/YN/KJ/PQ/142735335/asn-logo-90x90.png|psc_status=0|d_re=|u_url=https://www.asnexpo.com/|ast=A|lst=LST|ctid=70625|ct=Nagpur|stid=6489|st=Maharashtra|enterprise=0|mod_st=F|rating=4.6|nach=0|iec=ARRPN6869Q|is_suspect=0|vertical=KCD|pns_no=8048271237|gst=27ARRPN6869Q1ZC|pan=ARRPN6869Q|cin=|collectPayments=0|is_display_invoice_banner=0|is_display_enquiry=0|is_display_credit=0|disposition=|disp_date=|recreateUserDetCookie=|vid=|did=|fid=|src_ID=3|locPref_enable=1|comp_name=ASN Expo|hosting_date=10-Jul-2023|pay_later_navigation=0|pre_approved_loan_navigation=0',
  'xnHist'       : 'pv%3D0%7Cipv%3D45%7Cfpv%3D43%7Ccity%3D%7Clc_city%3Dundefined%7Ccvstate%3Dundefined%7Cpopupshown%3Dundefined%7Cinstall%3Dundefined%7Css%3Dundefined%7Cmb%3Dundefined%7Ctm%3Dundefined%7Cage%3Dundefined%7Ccount%3D0%7Ctime%3DFri%20May%2022%202026%2017%3A29%3A41%20GMT+0530%20%28India%20Standard%20Time%29%7Cglid%3D142735335%7Cgname%3Dundefined%7Cgemail%3Dundefined%7CcityID%3Dundefined',
  'yabs-sid'     : '1057329461779451985',
  'yandexuid'    : '78586261779264770',
  'ymex'         : '2094624770.yrts.1779264770#2094624770.yrtsi.1779264770',
  'yuidss'       : '78586261779264770',
};

db.prepare('UPDATE config SET cookies = ?, is_running = 0 WHERE id = 1').run(JSON.stringify(cookies));
console.log('✅ Cookies saved! Keys:', Object.keys(cookies).length);
console.log('Has ImeshVisitor:', !!cookies['ImeshVisitor']);
console.log('Has im_iss      :', !!cookies['im_iss']);
