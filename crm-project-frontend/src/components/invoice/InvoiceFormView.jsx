import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import AddInvoiceModal from "./AddInvoiceModal";

export default function InvoiceFormView() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <AddInvoiceModal
        isOpen={true}
        invoiceId={id || null}
        onClose={() => navigate("/invoices")}
        onSuccess={() => {
          navigate("/invoices");
        }}
      />
    </div>
  );
}
