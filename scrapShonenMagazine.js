const { parse } = require("node-html-parser");
const Canvas = require("@napi-rs/canvas");
const fs = require("fs");

const glsc = "";

const series = {
  週刊少年マガジン: {
    amagami: ["甘神さんちの縁結び"],
    sentai: ["戦隊大失格"],
    mayonaka: ["真夜中ハートチューン"],
    // highwall: ["Ｈｉｇｈ　ｗａｌｌ"],
  },
  アフタヌーン: {
    princess: ["７人の眠り姫", "7人の眠り姫"],
    omori: ["ＯＭＯＲＩ"],
  },
};

const magazine = {
  週刊少年マガジン: "wsm",
  アフタヌーン: "afternoon",
};

const path = "./series";

const urlMag = [""];

const numberFormat = new Intl.NumberFormat("fr-FR", {
  minimumIntegerDigits: 2,
});
const f = numberFormat.format;

const main = async (urlJSONs) => {
  if (!fs.existsSync(path)) fs.mkdirSync(path);
  if (!urlJSONs[0]) {
    urlJSONs = await getUrlJson();
  }
  urlJSONs.forEach(async (urlJSON) => {
    const page = await fetch(urlJSON, {
      headers: { Cookie: `glsc=${glsc}` },
    }).then((res) => res.text());
    const document = parse(page);
    const jsonBrut =
      document.querySelector("#episode-json").attrs["data-value"];
    const json = JSON.parse(jsonBrut);
    const starters = json.readableProduct.toc.items;
    const pages = json.readableProduct.pageStructure.pages;
    if (urlJSON.includes("volume")) {
      if (!fs.existsSync("./volume")) fs.mkdirSync("./volume");
      const titleSerie = json.readableProduct.series.title;
      const pathVolume = `./volume/${titleSerie}`;
      if (!fs.existsSync(pathVolume)) fs.mkdirSync(pathVolume);
      const name = json.readableProduct.title;
      const folder = `${pathVolume}/${name}`;
      if (fs.existsSync(folder)) return console.log(`${name} déjà dl`);
      fs.mkdirSync(folder);
      const pagesVolume = pages.filter((e) => e.src);
      const download = downloader(folder);
      await Promise.all(pagesVolume.map(download));
      console.log(`${name} end`);
      return;
    }
    const magSeries = Object.entries(series).filter(([index, value]) =>
      json.readableProduct.title.startsWith(index)
    )[0][1];
    Object.entries(magSeries).forEach(async ([index, value]) => {
      const debut = starters.filter((item) => value.includes(item.title));
      if (!debut) return console.log(`Pas de ${index} cette semaine`);
      await Promise.all(
        debut.map(async (serie, i) => {
          const seriesAfter = starters.at(starters.indexOf(serie) + 1);
          const start = serie.startAt;
          const end = seriesAfter ? seriesAfter.startAt : pages.length - 1;

          const pagesChapitre = pages.slice(start - 1, end - 1);
          const folderSeries = `./${path}/${index}`;
          if (!fs.existsSync(folderSeries)) fs.mkdirSync(folderSeries);
          const addIndex = debut.length > 1 ? "_" + (i + 1) : "";
          const folder = `${folderSeries}/${formatDate(
            json.readableProduct.publishedAt
          )}${addIndex}`;
          const name = index + (debut.length > 1 ? " " + (i + 1) : "");
          if (fs.existsSync(folder)) return console.log(`${name} déjà dl`);
          fs.mkdirSync(folder);
          const download = downloader(folder);
          await Promise.all(pagesChapitre.map(download));
          console.log(`${name} end`);
        })
      );
    });
    await firstPage(json);
  });
};

const getUrlJson = async () =>
  await Promise.all(
    Object.entries(series).map(async ([key, value], index) => {
      const res = await fetch(`https://comic-days.com/`).then((res) =>
        res.text()
      );
      const document = parse(res);
      const urlMagazine = Array.from(
        document.querySelectorAll(
          ".gtm-top-days-premium-weekly-item,.gtm-top-days-premium-monthly-item"
        )
      ).filter((e) => e.querySelector("h4").innerText == key)[0].attributes
        .href;
      return urlMagazine;
    })
  );

const downloader = (folder) => {
  return async (value, index) => {
    const image = await unscrap(value.src);
    fs.writeFileSync(`${folder}/${f(index + 1)}.jpg`, image);
  };
};

const unscrap = async (url) => {
  const image = await Canvas.loadImage(url);
  const height = image.height;
  const width = image.width;
  const final = new Canvas.Canvas(width, height);
  const context = final.getContext("2d");

  let largeur_piece = 272;
  if (width == 1125) largeur_piece = 280;
  const hauteur_piece = 400;

  const pieces = getCoordPieces(width, largeur_piece);

  const ordre_indices = [
    0, 5, 10, 15, 4, 1, 6, 11, 16, 9, 2, 7, 12, 17, 14, 3, 8, 13, 18, 19,
  ];

  ordre_indices.forEach((indice_partie, index) => {
    const src = pieces[indice_partie];
    const x = (index % 5) * largeur_piece;
    const y = Math.floor(index / 5) * hauteur_piece;
    context.drawImage(image, src.x, src.y, src.w, src.h, x, y, src.w, src.h);
  });

  return await final.encode("jpeg");
};

const getCoordPieces = (width, largeur_piece) => {
  const largeur_colonnes = [
    largeur_piece,
    largeur_piece,
    largeur_piece,
    largeur_piece,
    width - largeur_piece * 4,
  ];
  const hauteur_lignes = 400;
  const pieces = [];
  for (ligne = 0; ligne < 4; ligne++) {
    for (colonne = 0; colonne < 5; colonne++) {
      const x = sum(largeur_colonnes.slice(0, colonne));
      const y = ligne * hauteur_lignes;
      const w = largeur_colonnes[colonne];
      const h = hauteur_lignes;
      pieces.push({
        x: x,
        y: y,
        w: w,
        h: h,
      });
    }
  }
  return pieces;
};

const sum = (array) => array.reduce((acc, value) => acc + value, 0);

const formatDate = (date) => date.slice(0, 10);

const firstPage = async (json) => {
  const magSeries = Object.entries(magazine).filter(([index, value]) =>
    json.readableProduct.title.startsWith(index)
  )[0][1];
  const urlImage = json.readableProduct.pageStructure.pages[0].src;
  const image = await unscrap(urlImage);
  if (!fs.existsSync("./firstPage")) fs.mkdirSync("./firstPage");
  if (!fs.existsSync(`./firstPage/${magSeries}`))
    fs.mkdirSync(`./firstPage/${magSeries}`);
  const fichier = `./firstPage/${magSeries}/${formatDate(
    json.readableProduct.publishedAt
  )}.jpg`;
  if (fs.existsSync(fichier)) return console.log(`${magSeries} déjà dl`);
  fs.writeFileSync(`./${fichier}`, image);
  console.log(`First Page ${magSeries} END`);
};

main(urlMag);
