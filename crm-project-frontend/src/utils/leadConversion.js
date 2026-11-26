import Swal from "sweetalert2";

/**
 * Prompts the user to confirm the customer's login Email ID and set a password via SweetAlert2,
 * then sends the conversion request to the backend.
 * Returns the parsed JSON response on success, or null if cancelled.
 */
export async function promptAndConvertLeadToCustomer({
  leadId,
  defaultEmail = "",
  apiUrl,
  authToken,
  descriptionText = "This will create a customer record from this lead data.",
}) {
  const safeDefaultEmail = String(defaultEmail || "").replace(/"/g, "&quot;");

  const result = await Swal.fire({
    title: "Convert to Customer?",
    html: `
      <p style="font-size: 13px; color: #475569; margin-bottom: 14px;">${descriptionText}</p>
      <div style="text-align: left; display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label for="swal-customer-email" style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
            Customer Login Email ID <span style="color: #e11d48;">*</span>
          </label>
          <input
            id="swal-customer-email"
            type="email"
            value="${safeDefaultEmail}"
            placeholder="customer@company.com"
            autocomplete="email"
            style="width: 100%; box-sizing: border-box; padding: 9px 12px; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; color: #0f172a;"
          />
        </div>
        <div>
          <label for="swal-customer-password" style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
            Add Customer Password <span style="color: #e11d48;">*</span>
          </label>
          <div style="position: relative;">
            <input
              id="swal-customer-password"
              type="password"
              placeholder="Enter password for customer"
              autocomplete="new-password"
              style="width: 100%; box-sizing: border-box; padding: 9px 56px 9px 12px; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 8px; outline: none; color: #0f172a;"
            />
            <button
              type="button"
              id="swal-toggle-password"
              style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; font-weight: 600; color: #64748b; background: transparent; border: none; cursor: pointer;"
            >
              Show
            </button>
          </div>
        </div>
      </div>
    `,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, Convert",
    cancelButtonText: "Cancel",
    focusConfirm: false,
    didOpen: () => {
      const emailInput = document.getElementById("swal-customer-email");
      const pwdInput = document.getElementById("swal-customer-password");
      const toggleBtn = document.getElementById("swal-toggle-password");
      if (emailInput && !emailInput.value.trim()) {
        emailInput.focus();
      } else if (pwdInput) {
        pwdInput.focus();
      }
      if (pwdInput && toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          const isHidden = pwdInput.type === "password";
          pwdInput.type = isHidden ? "text" : "password";
          toggleBtn.textContent = isHidden ? "Hide" : "Show";
        });
      }
    },
    preConfirm: () => {
      const emailInput = document.getElementById("swal-customer-email");
      const pwdInput = document.getElementById("swal-customer-password");
      const email = emailInput ? emailInput.value.trim() : "";
      const pwd = pwdInput ? pwdInput.value : "";

      if (!email || !email.includes("@")) {
        Swal.showValidationMessage("Please enter a valid customer email ID for login.");
        return false;
      }
      if (!pwd || !pwd.trim()) {
        Swal.showValidationMessage("Please enter a password for the customer.");
        return false;
      }
      return { email, password: pwd };
    },
  });

  if (!result.isConfirmed) return null;

  const response = await fetch(`${apiUrl}${leadId}/convert-to-customer/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      email: result.value.email,
      password: result.value.password,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Failed to convert lead");
  }

  await Swal.fire({
    icon: "success",
    title: "Success!",
    text: data.message || "Lead converted to customer successfully",
    timer: 2000,
    showConfirmButton: false,
  });

  return data;
}
