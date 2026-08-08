"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { api, ApiError, Paginated } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { isAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import { Wallet, Receipt } from "lucide-react";
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
import { Pagination } from "@/components/pagination";
import { SortableHead } from "@/components/sortable-head";
import { DeleteButton } from "@/components/delete-button";

interface Expense {
  id: number;
  category: string;
  category_display: string;
  description: string;
  amount: string;
  expense_date: string;
  payment_method: string;
}

interface Summary {
  by_category: { category: string; total: string }[];
  grand_total: string;
}

const CATEGORIES = [
  { value: "rent", label: "Rent" },
  { value: "salary", label: "Salary" },
  { value: "utilities", label: "Utilities" },
  { value: "petrol", label: "Petrol/Fuel" },
  { value: "maintenance", label: "Maintenance" },
  { value: "supplies", label: "Office Supplies" },
  { value: "marketing", label: "Marketing" },
  { value: "other", label: "Other" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const PAGE_SIZE = 25;

export default function ExpensesPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [ordering, setOrdering] = useState("-expense_date");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState(false);

  const [category, setCategory] = useState("rent");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  function load() {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const params = new URLSearchParams({ page: String(page), ordering });
    api<Paginated<Expense>>(`/api/accounting/expenses/?${params}`)
      .then((data) => {
        setExpenses(data.results);
        setCount(data.count);
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load expenses."));
    api<Summary>(`/api/accounting/expenses/summary/?month=${month}`)
      .then(setSummary)
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "Failed to load expense summary."));
  }

  useEffect(load, [page, ordering]);

  async function addExpense() {
    if (!amount) {
      toast.error("Enter an amount.");
      return;
    }
    if (category === "other" && !description.trim()) {
      toast.error("Add a short description for miscellaneous/other expenses.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/accounting/expenses/", {
        method: "POST",
        body: JSON.stringify({
          category,
          description,
          amount,
          payment_method: method,
          expense_date: new Date().toISOString().slice(0, 10),
        }),
      });
      toast.success("Expense recorded.");
      setDescription("");
      setAmount("");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to record expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Rent, salaries, utilities, and any other shop overhead.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="gradient-primary border-none">Add Expense</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>Category</Label>
                <Select
                  items={Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]))}
                  value={category}
                  onValueChange={(v) => v && setCategory(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label>
                  Description {category === "other" ? "" : "(optional)"}
                </Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={category === "other" ? "What is this expense for?" : undefined}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Amount</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Payment method</Label>
                <Select
                  items={Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]))}
                  value={method}
                  onValueChange={(v) => v && setMethod(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addExpense} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {summary && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          <motion.div variants={fadeInUp} className="col-span-2 md:col-span-1">
            <Card className="gradient-primary h-full border-none shadow-md">
              <CardContent className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Wallet className="size-4" />
                </span>
                <div>
                  <p className="text-sm text-primary-foreground/80">This Month</p>
                  <p className="text-xl font-semibold">Rs. {summary.grand_total}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          {summary.by_category.slice(0, 3).map((row) => (
            <motion.div key={row.category} variants={fadeInUp}>
              <Card className="h-full">
                <CardContent className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Receipt className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground capitalize">{row.category}</p>
                    <p className="text-xl font-semibold">Rs. {row.total}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <motion.div initial="hidden" animate="visible" variants={fadeInUp}>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="expense_date" ordering={ordering} onSort={setOrdering}>
                  Date
                </SortableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Payment</TableHead>
                <SortableHead field="amount" ordering={ordering} onSort={setOrdering} className="text-right">
                  Amount
                </SortableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="size-6 opacity-50" />
                      <span>No expenses recorded yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {expenses.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.expense_date}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{e.category_display}</Badge>
                  </TableCell>
                  <TableCell>{e.description || "-"}</TableCell>
                  <TableCell className="capitalize">{e.payment_method.replace("_", " ")}</TableCell>
                  <TableCell className="text-right">Rs. {e.amount}</TableCell>
                  <TableCell className="text-right">
                    {admin && (
                      <DeleteButton
                        label={`Expense of Rs. ${e.amount}`}
                        onDelete={() => api(`/api/accounting/expenses/${e.id}/`, { method: "DELETE" })}
                        onDeleted={load}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} count={count} onPageChange={setPage} />
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}
