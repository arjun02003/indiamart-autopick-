const db = require('./db');

const cookies = {
  'IDE'          : 'AHWqTUkH3tXU8K7eMqiBrRoG4EXlaSy_XyiOEwlh-gXZtHHyoSgWnYgDeI-wvmfEcNA',
  'im_iss'       : 't%3DeyJhbGciOiJzaGEyNTYiLCJ0eXAiOiJKV1QifQ.eyJhdWQiOiI5KjYqNSo0KjMqIiwiY2R0IjoiMjEtMDUtMjAyNiIsImV4cCI6MTc3OTQzODg3MSwiaWF0IjoxNzc5MzUyNDcxLCJpc3MiOiJVU0VSIiwic3ViIjoiMTQyNzM1MzM1In0.HKSGy4zCu3IN66wb1QWvpAGPZb6iJDoqRqxOBdT2A8U',
  'ImeshVisitor' : 'SubUser%3D%7Cadmln%3D0%7Cadmsales%3D0%7Ccd%3D22%2FMAY%2F2026%7Ccmid%3D48%7Cctid%3D70625%7Cem%3Da%2A%2A%2A%2A%2A%2A%2A%2A%40gmail.com%7Ceotp%3D%7Cev%3DV%7Cfn%3DRAHUL%7Cglid%3D142735335%7Ciso%3DIN%7Cmb1%3D9860514336%7Cphcc%3D91%7Custs%3D%7Cutyp%3DP%7Cuv%3DV',
  'iploc'        : 'gcniso%3DIN%7Cgcnnm%3DIndia%7Cgctnm%3DNagpur%7Cgctid%3D70625%7Cgacrcy%3D100%7Cgip%3D27.97.160.11%7Cgstnm%3DMaharashtra',
  'Lda_aKUr6BGRn': 'hipodi.com/r/v2?',
  'Lda_aKUr6BGRr': '0',
  'LGNSTR'       : '0%2C2%2C0%2C1%2C1%2C1%2C1%2C0%2C1',
  'MUID'         : '2F1B2DF3FA0468E13F813AAEFB4069F4',
  'NID'          : '531=LGDbnEJ-rps3rV8FLX2lF-zRD7pJRcPYSkk8B9VFcxoAIN9vkceL1NODAn60NkOmxyrE95hg4W0BvZRbhsGp3puJZcZyVCQrSRp8JZO3CRGuHtn6Xc1PPh9tm2tzmFEiUNJWHmIef6UHn0mUn53t2-s9RqxTNEqsZzAT2lyHN4TiJhUeTFi5auN85AAVqSpHLiC1S27ToDlHo4sNMFuxETGqM4fMNOGx8o-ELU7yXoyTJ9fqZKCHbcNO8HROa3EJ7Sy2UT_8rXOga6xurYajuURZChUfhkanC8p5j8GNovqpAf3_yAddWITjvrBLCoNQd_J3Z-wmw_rSH0X3i3lfYIkM9T9RAk7u8_-LvSA3c_HR7jbNxYKOYW9xL77icUSgZOZdQ5gubmkHR61pw0sSGbt0WKSyooxmvVY2NJ60il645O7Y2qXk_WsyuQEnPZLwHz_6MYL4jeZzi4xfVQRVEEW40ABNkN5xSSjovMDx6k6bRLvt1j2QjkgtcJ5NklQLM3-7c-pGBDNzh9iuenhCo_6hnFzVK8ZSHVfYr1CPEag0ZnolvAmtJesXKRuInCDJhF5PbkVJKZIVmBqUi-G1S8kJH8GICzAXk0xgMT83jultsZoB2n-Ta5PwsP9fMz9_saLVnfvBYgqDBoL_-2k0_SNrVXLLejpVNLU-ljZCuEaCwpQ0gwnaOmxFBMaQxuXNkT7GtKsstDSgFqaMGh4UWdfxUaZK5G0w2x-ARrnUWQBKzQwg8SXISPZk_Ksj3vQAwdSRLQlsgj50g_CXH7L1LVmOs2kHq05O8eJK0uJTdm5bmE4u_39HqM2e4PFwv52KHzVaXNKCPR7DNEPtEBWBilT5nRG40tej5y9A1KuRfS3biiXLVUCtLFFMS4YT9Z4RjG6knX-odHPDl7GqE5wP4BQ5C4xDVHwS8sutyTthgj61AG15cQN4-x2lmM52cp5fDPVijmTASwcMFmq-Y_zUDspOubCFiclpj709UkXXQpOq5onzOz7HqNEKDZB6kD_IOqAIPji0WLmFlQPYFdIGUWE',
  'pop_mthd'     : 'FL%3D0%7CDTy%3D1',
  'SAPISID'      : 'Oup-TzOmT9sKeoIB/AjTS0eD6BzYB8hzmr',
  'SEARCH_SAMESITE': 'CgQI8KAB',
  'sessid'       : 'spv=8',
  'SID'          : 'g.a000-AgLXjeKw6CA5ObvbfRVNaUwe4xT8zbc8KkburEMHflbQ1DhV4FnLoWRxh50tpvuWGsyygACgYKAYMSARUSFQHGX2MiCgUL-kZ2AbJ0SMrKOfKJLRoVAUF8yKpnC-GI6DRvMnKgn_oGkxyz0076',
  'SIDCC'        : 'AKEyXzWqSKMBMJtuVspiDv_1b5ZuTI7JLr_s-qlvOg6KzJcz4CAjrti3aomDRYUWSStz7egVl5Q',
  'SSID'         : 'AhnSdnIr_FpLz8AXG',
  'user_choice_loc': '',
  'userDet'      : 'glid=142735335|loc_pref=3|fcp_flag=1|image=http://5.imimg.com/data5/ANDROID/GlPhoto/2023/3/294953594/NA/YH/ZW/142735335/myprofile-jpeg-64x64.jpg|service_ids=353,271,350,236,233,280|logo=https://5.imimg.com/data5/SELLER/Logo/2023/4/301589916/YN/KJ/PQ/142735335/asn-logo-90x90.png|psc_status=0|d_re=|u_url=https://www.asnexpo.com/|ast=A|lst=LST|ctid=70625|ct=Nagpur|stid=6489|st=Maharashtra|enterprise=0|mod_st=F|rating=4.6|nach=0|iec=ARRPN6869Q|is_suspect=0|vertical=KCD|pns_no=8048271237|gst=27ARRPN6869Q1ZC|pan=ARRPN6869Q|cin=|collectPayments=0|is_display_invoice_banner=0|is_display_enquiry=0|is_display_credit=0|disposition=|disp_date=|recreateUserDetCookie=|vid=|did=|fid=|src_ID=3|locPref_enable=1|comp_name=ASN Expo|hosting_date=10-Jul-2023|pay_later_navigation=0|pre_approved_loan_navigation=0',
  'xnHist'       : 'pv%3D0%7Cipv%3D37%7Cfpv%3D35%7Cglid%3D142735335',
  'yandexuid'    : '78586261779264770',
  'yuidss'       : '78586261779264770',
};

db.prepare('UPDATE config SET cookies = ?, is_running = 0 WHERE id = 1').run(JSON.stringify(cookies));
console.log('✅ Cookies saved! Keys:', Object.keys(cookies).length);
console.log('Has ImeshVisitor:', !!cookies['ImeshVisitor']);
console.log('Has im_iss      :', !!cookies['im_iss']);
