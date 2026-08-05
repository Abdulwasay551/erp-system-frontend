"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StaffUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: number;
  role_name: string;
  is_active: boolean;
}

interface Role {
  id: number;
  name: string;
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const [editFor, setEditFor] = useState<StaffUser | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editRoleId, setEditRoleId] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function loadUsers() {
    api<StaffUser[]>("/api/auth/users/")
      .then(setUsers)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load users."));
  }

  useEffect(() => {
    loadUsers();
    api<Role[]>("/api/auth/roles/").then(setRoles).catch(() => {});
  }, []);

  async function addUser() {
    if (!email || !roleId || !password) {
      toast.error("Email, role, and password are required.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/auth/users/", {
        method: "POST",
        body: JSON.stringify({
          email,
          first_name: firstName,
          last_name: lastName,
          role: Number(roleId),
          password,
        }),
      });
      toast.success("Staff account created.");
      setEmail("");
      setFirstName("");
      setLastName("");
      setPassword("");
      setOpen(false);
      loadUsers();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to create user.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(u: StaffUser) {
    setEditFor(u);
    setEditFirstName(u.first_name);
    setEditLastName(u.last_name);
    setEditRoleId(String(u.role));
    setEditActive(u.is_active);
    setEditPassword("");
  }

  async function saveEdit() {
    if (!editFor) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        first_name: editFirstName,
        last_name: editLastName,
        role: Number(editRoleId),
        is_active: editActive,
      };
      if (editPassword) body.password = editPassword;
      await api(`/api/auth/users/${editFor.id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success("Staff account updated.");
      setEditFor(null);
      loadUsers();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to update user.");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Staff Accounts</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button>Add Staff</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Staff Account</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>First name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Last name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Role</Label>
                <Select
                  items={Object.fromEntries(roles.map((r) => [String(r.id), r.name]))}
                  value={roleId}
                  onValueChange={(v) => v && setRoleId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button onClick={addUser} disabled={saving}>
                {saving ? "Creating..." : "Create Account"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {error ? error : "Manager/Owner only - staff account list"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    {u.first_name} {u.last_name}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{u.role_name}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "default" : "secondary"}>
                      {u.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog open={editFor?.id === u.id} onOpenChange={(open) => !open && setEditFor(null)}>
                      <DialogTrigger
                        render={
                          <Button variant="outline" size="sm" onClick={() => openEdit(u)}>
                            <Pencil className="size-3.5" /> Edit
                          </Button>
                        }
                      />
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            Edit {u.first_name} {u.last_name}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-2">
                              <Label>First name</Label>
                              <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label>Last name</Label>
                              <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label>Role</Label>
                            <Select
                              items={Object.fromEntries(roles.map((r) => [String(r.id), r.name]))}
                              value={editRoleId}
                              onValueChange={(v) => v && setEditRoleId(v)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {roles.map((r) => (
                                  <SelectItem key={r.id} value={String(r.id)}>
                                    {r.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between rounded-md border px-3 py-2">
                            <div>
                              <p className="text-sm font-medium">Active</p>
                              <p className="text-xs text-muted-foreground">Inactive staff can&apos;t log in.</p>
                            </div>
                            <Button
                              type="button"
                              variant={editActive ? "default" : "outline"}
                              size="sm"
                              disabled={u.id === currentUser?.id}
                              onClick={() => setEditActive((prev) => !prev)}
                            >
                              {editActive ? "Active" : "Inactive"}
                            </Button>
                          </div>
                          {u.id === currentUser?.id && (
                            <p className="text-xs text-muted-foreground">You can&apos;t deactivate your own account.</p>
                          )}
                          <div className="flex flex-col gap-2">
                            <Label>Reset password (optional)</Label>
                            <Input
                              type="password"
                              placeholder="Leave blank to keep current password"
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                            />
                          </div>
                          <Button onClick={saveEdit} disabled={editSaving}>
                            {editSaving ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
