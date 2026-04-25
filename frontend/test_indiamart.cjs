const axios = require('axios');

const cookiesRaw = [
  {"name": "im_iss", "value": "t%3DeyJhbGciOiJzaGEyNTYiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiI5KjYqMSo3KjkqIiwiY2R0IjoiMjQtMDQtMjAyNiIsImV4cCI6MTc3NzEzNTQ5OCwiaWF0IjoxNzc3MDQ5MDk4LCJpc3MiOiJVU0VSIiwic3ViIjoiNzA1NTQ3MjkifQ.ANv-m-HnvRIF61inX5HhHEgmnc0pm1m-G3DVlnbBvyg"},
  {"name": "ImeshVisitor", "value": "SubUser%3D%7Cadmln%3D0%7Cadmsales%3D0%7Ccd%3D25%2FAPR%2F2026%7Ccmid%3D48%7Cctid%3D70625%7Cem%3Ds%2A%2A%2A%2A%2A%2A%2A%2A%2A%2A%2A%2A%2A%40gmail.com%7Ceotp%3D%7Cev%3DV%7Cfn%3DRahul%7Cglid%3D70554729%7Ciso%3DIN%7Cmb1%3D9561117392%7Cphcc%3D91%7Custs%3D%7Cutyp%3DP%7Cuv%3DV"},
  {"name": "iploc", "value": "gcniso%3DIN%7Cgcnnm%3DIndia%7Cgctnm%3DNagpur%7Cgctid%3D70625%7Cgacrcy%3D200%7Cgip%3D27.97.172.136%7Cgstnm%3DMaharashtra"},
  {"name": "LGNSTR", "value": "0%2C2%2C0%2C1%2C1%2C1%2C1%2C0%2C1"},
  {"name": "pop_mthd", "value": "FL%3D0%7CDTy%3D1"},
  {"name": "sessid", "value": "spv=9"},
  {"name": "userDet", "value": "glid=70554729|loc_pref=3|fcp_flag=1|image=http://5.imimg.com/data5/ANDROID/GlPhoto/2025/2/491593470/XW/DZ/ME/70554729/myprofile-jpeg-64x64.png|service_ids=233,349|logo=https://5.imimg.com/data5/SELLER/Logo/2025/2/491573230/QZ/HM/MX/70554729/new-logo-90x90.png|psc_status=0|d_re=|u_url=https://www.indiamart.com/skyline-expo/|ast=A|lst=LST|ctid=70625|ct=Nagpur|stid=6489|st=Maharashtra|enterprise=0|mod_st=F|rating=4.9|nach=0|iec=CIGPK7371A|is_suspect=0|vertical=KCD|pns_no=7949283059|gst=27CIGPK7371A1ZC|pan=CIGPK7371A|cin=|collectPayments=0|is_display_invoice_banner=0|is_display_enquiry=0|is_display_credit=0|disposition=|disp_date=|recreateUserDetCookie=|vid=|did=|fid=|src_ID=2|locPref_enable=1|comp_name=Skyline Expo Nagpur|hosting_date=21-Feb-2025|pay_later_navigation=0"},
  {"name": "xnHist", "value": "pv%3D0%7Cipv%3D23%7Cfpv%3D14%7Ccity%3DNashik%7Clc_city%3Dundefined%7Ccvstate%3Dundefined%7Cpopupshown%3Dundefined%7Cinstall%3Dundefined%7Css%3Dundefined%7Cmb%3Dundefined%7Ctm%3Dundefined%7Cage%3Dundefined%7Ccount%3D0%7Ctime%3DFri%20Apr%2024%202026%2017%3A43%3A43%20GMT-0700%20%28Pacific%20Daylight%20Time%29%7Cglid%3D70554729%7Cgname%3Dundefined%7Cgemail%3Dundefined%7CcityID%3Dundefined"},
  {"name": "yashr", "value": "8686112861776614355"},
  {"name": "__gsas", "value": "ID=8ee34a5ecef26a6b:T=1777037451:RT=1777077826:S=AA-AfjbPVG82sgJkzEal8u0vJkiQ"},
  {"name": "ymex", "value": "2079708193.yrts.1764348193#2079708193.yrtsi.1764348193"},
  {"name": "yuidss", "value": "917352621764348193"},
  {"name": "MUID", "value": "29BF0CCAB06663E3308A1AB8B1FD626E"},
  {"name": "pi", "value": "TOQZC0+KK1f+0pjsoTqjZLC8I3VkTU8LHVlXW8RNP7PJpe/p2DMmteLe3xIehaowKuqGv74COcZfGv1DhyMT/wMW4oA="},
  {"name": "receive-cookie-deprecation", "value": "1"},
  {"name": "user_choice_loc", "value": ""},
  {"name": "yandexuid", "value": "917352621764348193"},
  {"name": "_ym_uid", "value": "1774711146516057931"},
  {"name": "_ym_d", "value": "1774711146"},
  {"name": "_ym_isad", "value": "2"}
];

const cookieString = cookiesRaw.map(c => `${c.name}=${c.value}`).join('; ');

async function test() {
  try {
    const response = await axios.post('https://seller.indiamart.com/lmsreact/getContactList', {}, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Referer': 'https://seller.indiamart.com/leadmanager/',
        'Origin': 'https://seller.indiamart.com'
      }
    });
    console.log("Status:", response.status);
    console.log("Data Type:", typeof response.data);
    if (typeof response.data === 'string') {
        console.log("HTML length:", response.data.length);
        console.log("Snippet:", response.data.substring(0, 150));
    } else {
        console.log("Lead[0]:", response.data.result ? response.data.result[0] : response.data);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

test();
