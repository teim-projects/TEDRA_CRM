import React from "react";
import Base from "../components/Base";
import RolePermissionManagement from "../components/accounts/RolePermissionManagement";
import { getBaseApiUrl } from "../utils/apiConfig";

export default function RolesPage() {
  const BASE_API = getBaseApiUrl();

  return (
    <Base title="">
      <RolePermissionManagement baseApi={BASE_API} />
    </Base>
  );
}
