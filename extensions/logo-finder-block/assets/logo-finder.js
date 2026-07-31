(function () {
  "use strict";

  function initLogoFinder(root) {
    const proxyBase = root.dataset.proxyBase;

    const form = root.querySelector("[data-lf-form]");
    const urlInput = root.querySelector("[data-lf-url-input]");
    const submitBtn = root.querySelector("[data-lf-submit]");
    const formError = root.querySelector("[data-lf-error]");

    const status = root.querySelector("[data-lf-status]");
    const statusText = root.querySelector("[data-lf-status-text]");

    const logoPreview = root.querySelector("[data-lf-logo-preview]");
    const logoImg = root.querySelector("[data-lf-logo-img]");
    const confirmLogoBtn = root.querySelector("[data-lf-confirm-logo]");
    const retryBtn = root.querySelector("[data-lf-retry]");

    const results = root.querySelector("[data-lf-results]");
    const grid = root.querySelector("[data-lf-grid]");
    const emailForm = root.querySelector("[data-lf-email-form]");
    const emailInput = root.querySelector("[data-lf-email-input]");
    const emailError = root.querySelector("[data-lf-email-error]");

    const state = {
      websiteUrl: "",
      logoDataUrl: "",
      logoSourceUrl: "",
      previews: [],
    };

    function showStatus(text) {
      statusText.textContent = text;
      status.hidden = false;
    }
    function hideStatus() {
      status.hidden = true;
    }
    function setError(el, message) {
      if (!message) {
        el.hidden = true;
        el.textContent = "";
        return;
      }
      el.textContent = message;
      el.hidden = false;
    }
    function resetFlow() {
      logoPreview.hidden = true;
      results.hidden = true;
      grid.innerHTML = "";
      setError(formError, "");
      urlInput.value = "";
      urlInput.focus();
    }

    async function postJSON(path, body) {
      const res = await fetch(proxyBase + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      return data;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError(formError, "");
      const url = urlInput.value.trim();
      if (!url) return;

      state.websiteUrl = url;
      logoPreview.hidden = true;
      results.hidden = true;
      submitBtn.disabled = true;
      showStatus("Finding your logo…");

      try {
        const data = await postJSON("/scrape", { url });
        state.logoDataUrl = data.logoUrl;
        state.logoSourceUrl = data.sourceUrl || "";
        logoImg.src = data.logoUrl;
        logoPreview.hidden = false;
      } catch (err) {
        setError(formError, err.message);
      } finally {
        hideStatus();
        submitBtn.disabled = false;
      }
    });

    retryBtn.addEventListener("click", () => {
      resetFlow();
    });

    confirmLogoBtn.addEventListener("click", async () => {
      logoPreview.hidden = true;
      showStatus("Creating your branded products…");

      try {
        const data = await postJSON("/generate", { logoUrl: state.logoDataUrl });
        state.previews = data.previews || [];
        renderResults();
        results.hidden = false;
      } catch (err) {
        setError(formError, err.message);
        logoPreview.hidden = false;
      } finally {
        hideStatus();
      }
    });

    function renderResults() {
      grid.innerHTML = "";
      state.previews.forEach((preview) => {
        const card = document.createElement("div");
        card.className = "logo-finder__card is-locked";

        const img = document.createElement("img");
        img.src = preview.dataUrl;
        img.alt = preview.name;

        const label = document.createElement("div");
        label.className = "logo-finder__card-label";
        label.textContent = preview.name;

        const download = document.createElement("button");
        download.type = "button";
        download.className = "logo-finder__card-download";
        download.textContent = "Download";
        download.addEventListener("click", () => downloadImage(preview));

        card.appendChild(img);
        card.appendChild(download);
        card.appendChild(label);
        grid.appendChild(card);
      });
    }

    function downloadImage(preview) {
      const link = document.createElement("a");
      link.href = preview.dataUrl;
      link.download = preview.id + ".png";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    function unlockResults() {
      grid.querySelectorAll(".logo-finder__card").forEach((card) => {
        card.classList.remove("is-locked");
      });
      emailForm.classList.add("is-unlocked");
    }

    emailForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError(emailError, "");
      const email = emailInput.value.trim();
      if (!email) return;

      try {
        await postJSON("/email", {
          email,
          websiteUrl: state.websiteUrl,
          logoImageUrl: state.logoSourceUrl,
        });
        unlockResults();
      } catch (err) {
        setError(emailError, err.message);
      }
    });
  }

  function init() {
    document.querySelectorAll(".logo-finder").forEach((root) => {
      if (root.dataset.lfInitialized) return;
      root.dataset.lfInitialized = "true";
      initLogoFinder(root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
