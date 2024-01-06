const { parse } = require("node-html-parser");
const Canvas = require("@napi-rs/canvas");
const fs = require("fs");

const glsc = "";

const series = {
  週刊少年マガジン: {
    amagami: "甘神さんちの縁結び",
    medaka: "黒岩メダカに私の可愛いが通じない",
    sentai: "戦隊大失格",
    cuckoos: "カッコウの許嫁",
  },
  アフタヌーン: {
    princess: "7人の眠り姫",
  },
};

const path = "./series";

const urlMag = [];

const numberFormat = new Intl.NumberFormat("fr-FR", {
  minimumIntegerDigits: 2,
});
const f = numberFormat.format;

const main = async (urlJSONs) => {
  if (!fs.existsSync(path)) fs.mkdirSync(path);
  if (!urlJSONs[0]) {
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
        urlJSONs[index] = urlMagazine + ".json";
      })
    );
  }
  urlJSONs.forEach(async (urlJSON) => {
    const json = await fetch(urlJSON, {
      headers: { Cookie: `glsc=${glsc}` },
    }).then((res) => res.json());
    const starters = json.readableProduct.toc.items;
    const pages = json.readableProduct.pageStructure.pages;
    const magSeries = Object.entries(series).filter(([index, value]) =>
      json.readableProduct.title.startsWith(index)
    )[0][1];
    Object.entries(magSeries).forEach(async ([index, value]) => {
      const debut = starters.filter((item) => item.title == value);
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
  });
};

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
  const pieces = getCoordPieces();

  const ordre_indices = [
    0, 5, 10, 15, 4, 1, 6, 11, 16, 9, 2, 7, 12, 17, 14, 3, 8, 13, 18, 19,
  ];

  const largeur_piece = 272;
  const hauteur_piece = 400;

  ordre_indices.forEach((indice_partie, index) => {
    const src = pieces[indice_partie];
    const x = (index % 5) * largeur_piece;
    const y = Math.floor(index / 5) * hauteur_piece;
    context.drawImage(image, src.x, src.y, src.w, src.h, x, y, src.w, src.h);
  });

  return await final.encode("jpeg");
};

const getCoordPieces = () => {
  const largeur_colonnes = [272, 272, 272, 272, 27];
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

main(urlMag);
