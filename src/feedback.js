// Feedback form on the support pages: posts {name, email, app, message, company}
// to /api/feedback. Only a 200 with {ok:true} counts as success.
(function () {
  var MESSAGES = {
    ok: "Thanks. Your message was sent, and we'll reply by email.",
    notLive: "The form isn't live yet — please use the contact link above.",
    email: "Please enter a valid email address.",
    message: "Please enter a message.",
    tooLong: "Please keep your message under 4,000 characters.",
    failed: "Something went wrong and your message wasn't sent. Please try again later, or use the contact link above.",
  };

  function show(el, text, kind) {
    el.textContent = text;
    el.className = "dm-status " + kind;
  }

  document.querySelectorAll("form.dm-feedback").forEach(function (form) {
    var status = form.querySelector(".dm-status");
    var button = form.querySelector("button");
    var f = form.elements;

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var email = f.email.value.trim();
      var message = f.message.value.trim();
      if (email === "" || !f.email.checkValidity()) {
        show(status, MESSAGES.email, "err");
        f.email.focus();
        return;
      }
      if (message === "") {
        show(status, MESSAGES.message, "err");
        f.message.focus();
        return;
      }
      if (message.length > 4000) {
        show(status, MESSAGES.tooLong, "err");
        f.message.focus();
        return;
      }

      button.disabled = true;
      show(status, "Sending…", "");

      fetch(form.action, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: f.name.value.trim(),
          email: email,
          app: f.app.value,
          message: message,
          company: f.company.value,
        }),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) {
            if (res.status === 200 && body.ok === true) {
              show(status, MESSAGES.ok, "ok");
              form.reset();
            } else if (res.status === 503) {
              show(status, MESSAGES.notLive, "warn");
            } else {
              show(status, MESSAGES.failed, "err");
            }
          });
        })
        .catch(function () {
          show(status, MESSAGES.failed, "err");
        })
        .then(function () {
          button.disabled = false;
        });
    });
  });
})();
