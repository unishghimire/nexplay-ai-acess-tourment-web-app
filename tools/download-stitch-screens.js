import fs from 'fs';
import path from 'path';
import https from 'https';

const screens = [
  {
    id: "df2333ae432d4372bde4461a2d2c0837",
    index: "01",
    name: "nexplay_compact_esports_mobile_ui",
    title: "NexPlay Compact Esports Mobile UI",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1WCaQqv7WT9L3W9_QYNlkpZX6HI0LvV66qfw4im_g7u2HVA5e8HHmW6BnM8vq3Xc2r0ACoIG79bQZUm2n4hgUrV2whJuhStJLkUR5b8I3MyC60SUqgjLss3sjLqDSITtGDjS_00NABsgDAqwxHkrm90YXbYCLJjd2xZf42Lgy-YqRuYO0XAw8D3PohJY01o5Xx0V2AwSPTAM5Z4R-dVrblgD0_k368BOmluShQRYb8qQ8J2omqSdP_p7Lep",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxZjgxM2QwN2EwMmE5YjM1ZWYyMTAzNzdlEgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "96b38f12e7ac499584ae9c9a28b15e1f",
    index: "02",
    name: "nexplay_master_footer_exact_blueprint",
    "title": "NexPlay Master Footer Exact Blueprint",
    img: null,
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgyMTE5MWZkNDcwN2M0ZWRhOGI5MmM2N2QzEgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "1aa775d6e4e84d7c9097641e795d2394",
    index: "03",
    name: "nexplay_games_mobile_ui_polished_native_nav",
    title: "NexPlay Games Mobile UI - Polished & Native Nav",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1Ubyj_kHeuA9czA7jtKDZ_sBuLWxx8y9yO7qhLZWiOS9-OhsWzsC0azKOzozSU7MTg7P-E5dqNJjLWnzAY7HtwjjbZprOauo0bP2k0KjAT5Osm6Qvg-gn8nfxT9FSfYSIBMy2uH0cou2iqk2FA0R6zRTzOKiUd7sxQmm2Bm0vwLVubl1FXNa7ql4V92otBoZ08cvQqNJ7JQghQFR6bfeb652gJzw3LxER2g-k9mWmIhV8F6XbCHEU7oWLo",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxZmRlZWI5ODYwMjJkNDE4OWQzMWRjMzMzEgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "700e0fdd3a4f4066896cea23dc06b240",
    index: "04",
    name: "nexplay_contact_organizer_mobile_ui",
    title: "NexPlay Contact & Organizer Mobile UI",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1UD_dPsCp64RYFRq2JOpDuSlgwcvuxx5ysu8-fSTdzZjhFfXnvhcHPh9uoaYkDxrFzkL7UAx86xEtVEFgMtApFdR2T1_WOP8bNs-Px1lSB8l-60cL2-yFirKatxB6xx0e5ZrjmBfI856wlfRrxGiJAnFlptRWOiqU3Xqoousrv8_K2wMwdTc59KkFw4vbP2zU9d9i20_eZ-_704PdYi1ihd6bN8kXb3OtEscU-pZwxaiPoaueAAa7wgTh1x",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxYjFkZDE2NDAwMzgzODY2ZTFlMDE2OTY2EgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "1a59c520705748a1ae7bcae7f2b751c9",
    index: "05",
    name: "nexplay_free_fire_bridge_tournaments_scrims_hub",
    title: "NexPlay Free Fire Bridge - Tournaments & Scrims Hub",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1VjkdWjltS7WCihhmZHgamG7QPRuYBl4A2jDDFvrZhERJfBp6MJnWHrDrfwxZkFOTIrzfkKpnbkh0EaWxRfO52dxAahk68Zb1fRR2GsoHVs32D_x02SbbWOTpPVB-qlGewQnP8QFfaa-qir0FEtRMeBv7PGmrkkTnKnqSN2-Lo01alp3MLrEUx8IlekDVlDyxy9Ptpa_u7jU75zHQAL7HdoMKAkKLMU6PHLQZSvG78qqoLDMh0c-vo2KX8x",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxYjFhOWM4MmMwN2M0Yzk5OWY3MWE3MjgzEgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "1cdf599614ec4818883193d5737725c5",
    index: "06",
    name: "nexplay_organizations_mobile_ui",
    title: "NexPlay Organizations Mobile UI",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1X2E7QuvX62-byq3lTve9T4sSIfctw5LBg8rsgyv0raMawmDDeoxnL8VgwmcbsQ9rO_5ZCQs0U1iVZcfAu9i6SrJDTGX6HefKaXbbrplsiA0-jvJo4f-LGOZjFRi2dFQqObwFOXiUXbopLIrZ8udgrvv7ZQGK3GFcQPQ-zAv6H2iLP6p68xpfxQ5Jxdgaxr6Kk-6nrXlhebcE9CII9BsDuPxNpWPxzIX_XNc8HeCsuhKtfWtdYJV2jV772Q",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxZmUwMGJmZTIwNTRjYzNjZmY4MmY5Y2Y3EgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "f7d5d88d115f40d594c8c16ce40e2b26",
    index: "07",
    name: "nexplay_about_us_mobile_ui",
    title: "NexPlay About Us Mobile UI",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1XmtxpLfg838ImUxsgADWZmqf3C7x9w3SOFJzfgDOwmdopmcgNaexRzCXCawb3zpyQkZP1bGgX5wDhg4KvyOguifu2OvBsYseFdDhi6Qv-fvxfz2j3BFVP7CxLVdVehTIvs0WGVPoX09uicA2LbVcI3fGwlB2fpBRY1w88Nza-Uw1nvOzVQ_oeu5ktSIFHih7NWynptrj3KP3SdE9qM0Yy0_B4Lb6hpOhY4vpDIUu_Yv703Vx0nD2yPJbRY",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxZTczZTdlMjYwMzM4NGJjOTY4MDE2YzU3EgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "b6ab30a9c071403aaa9f60423867235e",
    index: "08",
    name: "nexplay_terms_of_service_mobile_ui",
    title: "NexPlay Terms of Service Mobile UI",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1UQR6G9XuHzinK9_1MZSu2LHthkIvjapPcB51-1Gf-NzUsT3d3JGjkH8xbE-fyPkl_bS54fl2b7C9cEPt2LPnHPIRfY_SKN87KyBY-rjFd282vyKO1p_iCm6FJlL7uMC8_6KvHzAfk9xWo7r6KHfOdaaqrmTt6THJfnOrEzq3S9cFZDdxQ-cfdXSPSPY4CevVlAKj49kdCQtV29WemN5Lwy_OxkLIBzK2Upa4sOD1cLYyRDOaA5utQVUA6u",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxZWFkNzk2MjAwMzM4NDc2NGVhMzVjMmI4EgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "9ac0a0881823473f95884e9d8535ad41",
    index: "09",
    name: "nexplay_privacy_policy_mobile_ui",
    title: "NexPlay Privacy Policy Mobile UI",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1U7BPZ-XKuPOaa7GpZEI8AnvGC4_5lqnJPOZXYVDTRS04eVXct0JnH2MR0YnsOkAOPwvwlCoApFCYw_1TvtNqZAkXJgpapOWm9S_ZLgzRI7TL1eHjueQa6sYBcTk3rz8wL7p4ER5wpCUNHel11LmyDKiisSQ7BZY1PEpJxDxzHGyvEeb6jUZKfhlfUDcLY55Byc8mtG9FR0XHcvC96U-pAgsHWBjntL3MvMCc0j4ALO92LZi0ev35al-sdk",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxZWZmYTBjMGYwMmE5YjM1ZWYyMTAzNzdlEgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "566fe40326df4766aa959beb21996810",
    index: "10",
    name: "nexplay_free_fire_tournaments_select_mode",
    title: "NexPlay Free Fire Tournaments - Select Mode",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1XzGlVREd0QTBE6q0fGIxXo9wk1gse0zaXjjhcnXoin74YJ_JCxFk8P-ipg1Zfl_cObJTvaSNauhu8UYXRDU-w-pviAz_MvDDErkRIzzWQxMSMvOrvPYW7r9bEogtakydn59kBdCOlio38IoR0KwpSSEUPjXuH19D29Hr5VSlslq0Y0jnQiPX4F8pejPI68E41rRmKcVaGD4bn1GT5c_XZOVC4wQVHXdZQx72vfPuSaVPS1ic1Ii1zwPyo0",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxYjFlZjM1NmEwMWE2MzEyMzY4M2I4NzY0EgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "3e3622b87e3b4392917d15297155f1c8",
    index: "11",
    name: "nexplay_news_mobile_ui_full_esports_feed",
    title: "NexPlay News Mobile UI - Full Esports Feed & Coverage",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1Xdl8W_Z-QHaWpxjywqYZE1rDHRK4xEibI8DFN_7I98uyYSfsy9cF4PtV-x04msAKnkooE2Fvtzml8UgERXmVwUQhD0KK20p-dK5OQnHuiku1xqw9pQMCWv82_DMyS9EthqF89b1auq_Vz04_8dGk0zaRDlsFeEpg6ti1DiVs_PH7s4OzNH8b34PoIQC9bwU5z_mjA-M90Xb5x5QGw-o4GbeEYJ-5YIj-caq_qKCI5SIRYUAgc8vtFJmGQ",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxYjE3YWUzNDUwMmE5YjM1ZWYyMTAzNzdlEgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "840ab997039246efb8e21fc5c39cd553",
    index: "12",
    name: "nexplay_profile_mobile_ui_clean_footer",
    title: "NexPlay Profile Mobile UI - Clean Footer & Navigation",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1XrsBOzAIIN4tLj0jZXoTXBmmvCkzXgxpmjPMRKJldsSdLPMWU8x_KoAfHxzIZw798KIvG2Km3BkFRXPGq62WjwWtYEEV0EdqtOrC8I2saGsBE3Mb19eHeFZCL2X6g5dvyZIxFxR2ILKf-O83xEUJm6fYotcMIRisf0M3udqyNI3aq35ktd_weViL7xcG-Jxlk3TKINrWlxqkrVMXoIXPvYnzuowaikt-ndT-_kWI4Kc38CxBBG4Jv9RI8",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxYjE2OWY3YjUwNzc5OWU3MDhiMzQ4NjIyEgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "da94c00cf636453d92edcd637c45d530",
    index: "13",
    name: "nexplay_tournament_browser_mobile_ui",
    title: "NexPlay Tournament Browser Mobile UI",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1WSQHnZBbBnN70FKuRfdjQhED0sRqsj5GzhL1IHXz_iH64EpdD7HDFE0pDKJMzFFifvlXuxR7Kqz3hdmFYjI6p3Wx2yESY2o5F3DinSNgP-LNhBpUCeq4RgEke4VVbaQ0jU8rsQqj0nkGPRvDJExoA7NMl3K4acC9tHhyHRQXhWp2veHkerLA19NFNOHm4-vhV5oTVezZhGP9-gCK9pig5EXow4N_XOt4FmwZcSnY3Tx88ValZSNWahidqb",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxYjFjYjgyOTAwMmE5YjMwMDM0Mzk4ZWMyEgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "9eb13ee295f34885838ac324e5cb8fe2",
    index: "14",
    name: "nexplay_wallet_mobile_ui_funds_ledger",
    title: "NexPlay Wallet Mobile UI - Funds & Ledger",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1V3BgSuPVMjgQE1TvXjj8O5cVlFoAIp4kMJwL0kzVvVcXVI73Zx0UfsZ72-hjCxu8GtsWfLxewROqqlfa6-8uG9iIhPQc4If0LYmaDGy0lIi-wjipV4c_LglF-yfFrB_YGJx0tPY4666BIHttfDD8JnMUNnrJRNIAK3pAL9pvfaY4mUrvkHtajQ0pUBAM5Jw8zd2kT8hJ6HuRfPHuc9QKLEvIiWOGbTXFu332BikYfbhyo2AOtfotEf7ZJC",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxYjE5ZGFmMmQwMzM4NjAxYWZiMDM2YzIxEgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  },
  {
    id: "ca361a6e54aa4d9982491333bdebe3fa",
    index: "15",
    name: "nexplay_dashboard_mobile_ui_modern_esports_hub",
    title: "NexPlay Dashboard Mobile UI - Modern Esports Hub",
    img: "https://lh3.googleusercontent.com/aida/AEtjO1VxSPqXtIr6BQmpXpyyVIeofhGJtvN0zx1S3AwkWqebM0j53aLv1xLG1Tfg5RU9d1uHs6SwfD59OuotqLCuUIOdzwxrdrb5wdHGkx7pcTaSHvo9z74Q3hPKAUSdvR4XD40zCd4MQ2zQpdZR8NElJrR1WWR2X0wB5sMGKBcuD6z7Fp2i1XOPV5GclMI8_4VRyqdeyIw3L49u-jF0ymWPCFRgR4MiVP2thejzwsScqs8FcUPu9rB-gKYxp7jO",
    html: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1YjgxYjFiZTAwZjIwMWVlNWNiMGMwMDI3NmZkEgsSBxD906G65RAYAZIBJAoKcHJvamVjdF9pZBIWQhQxNTYwODcxMTkxMzU3MjgxNzA4OA&filename=&opi=89354086"
  }
];

const outDir = path.resolve('stitch_designs');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
      }
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log(`Downloading ${screens.length} Stitch screens to ${outDir}...`);
  for (const s of screens) {
    const base = `${s.index}_${s.name}`;
    console.log(`Processing [${s.index}/15] ${s.title}...`);

    if (s.html) {
      const htmlPath = path.join(outDir, `${base}.html`);
      try {
        await download(s.html, htmlPath);
        console.log(`  ✓ HTML saved: ${base}.html`);
      } catch (err) {
        console.error(`  ✗ Failed HTML: ${err.message}`);
      }
    }

    if (s.img) {
      const imgPath = path.join(outDir, `${base}.png`);
      try {
        await download(s.img, imgPath);
        console.log(`  ✓ Image saved: ${base}.png`);
      } catch (err) {
        console.error(`  ✗ Failed Image: ${err.message}`);
      }
    }
  }

  // Also write an index manifest JSON with metadata
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(screens, null, 2), 'utf8');
  console.log('✓ manifest.json written successfully.');
  console.log('All Stitch screens downloaded successfully!');
}

run();
