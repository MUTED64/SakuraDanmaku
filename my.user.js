// ==UserScript==
// @name         SakuraDanmaku
// @namespace    http://muted.top/
// @version      0.1
// @description  yhdm, but with Danmaku from Bilibili
// @author       MUTED
// @match        https://www.yhdmp.cc/yxsf/player/dpx2/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=yhdmp.cc
// @grant        GM_xmlhttpRequest
// @require      https://cdn.jsdelivr.net/npm/danmaku@latest/dist/danmaku.min.js
// ==/UserScript==
(async function () {
  "use strict";
  let episode = 1; // 第几话
  let episode_url = "https://www.bilibili.com/bangumi/play/ep674708";

  function makeGetRequest(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        onload: function (response) {
          resolve(response.responseText);
        },
        onerror: function (error) {
          reject(error);
        },
      });
    });
  }

  // Bilibili弹幕xml串转换为可加载的对象
  function bilibiliParser(string) {
    const $xml = new DOMParser().parseFromString(string, "text/xml");
    return [...$xml.getElementsByTagName("d")]
      .map(($d) => {
        const p = $d.getAttribute("p");
        if (p === null || $d.childNodes[0] === undefined) return null;
        const values = p.split(",");
        const mode = { 6: "ltr", 1: "rtl", 5: "top", 4: "bottom" }[values[1]];
        if (!mode) return null;
        const fontSize = Number(values[2]) || 25;
        const color = `000000${Number(values[3]).toString(16)}`.slice(-6);
        return {
          text: $d.childNodes[0].nodeValue,
          mode,
          time: values[0] * 1,
          style: {
            fontSize: `${fontSize}px`,
            color: `#${color}`,
            textShadow:
              color === "00000"
                ? "-1px -1px #fff, -1px 1px #fff, 1px -1px #fff, 1px 1px #fff"
                : "-1px -1px #000, -1px 1px #000, 1px -1px #000, 1px 1px #000",

            font: `${fontSize}px sans-serif`,
            fillStyle: `#${color}`,
            strokeStyle: color === "000000" ? "#fff" : "#000",
            lineWidth: 2.0,
          },
        };
      })
      .filter((x) => x);
  }

  // 获取Bilibili对应视频的xml弹幕
  const EP_API_BASE = "https://api.bilibili.com/pgc/view/web/season/";
  const DANMAKU_API_BASE = "https://api.bilibili.com/x/v1/dm/list.so/";
  async function fetchBilibili(url) {
    let epid = (url.match(/\/ep(\d+)/i) || [])[1] || "";
    let { code, message, result } = JSON.parse(
      await makeGetRequest(`${EP_API_BASE}?ep_id=${epid}`)
    );
    if (code) {
      throw new Error(message);
    }
    let cid = result.episodes[episode - 1].cid;
    let comments = bilibiliParser(
      await makeGetRequest(`${DANMAKU_API_BASE}?oid=${cid}`)
    );
    let basic_info = { epid, cid, comments };
    localStorage[`basic_info_${cid}`] = JSON.stringify(basic_info);
    return basic_info;
  }

  // 使video脱离文档流，为弹幕留出空间
  $("video")[0].style.position = "absolute";

  // 加载弹幕
  const container = $(".dplayer-video-wrap")[0];
  const media = $(".dplayer-video")[0];
  let danmaku = new Danmaku({
    container: container,
    media: media,
    comments: (await fetchBilibili(episode_url)).comments,
    speed: 144,
  });
  danmaku.show();

  // 调整响应式
  let resizeObserver = new ResizeObserver(() => {
    console.log("The element was resized");
    danmaku.resize();
  });
  resizeObserver.observe(container);
})();
