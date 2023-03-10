import { createContext, ReactNode, useCallback, useEffect, useState } from "react";
import { api } from "../lib/axios";

import { InkColors } from "../utils/inks";

export interface InkStock {
  amount: number;
  color: InkColors;
}

export interface Printer {
  id: number;
  name: string;
  isColorful: true;
  stock: InkStock[];
  category: "printer";
  department: "qualidade" | "pcp" | "custos" | "rh";
}

interface InkStockHistory {
  id: number;
  date: Date;
  amount: number;
  color: InkColors;
  deliveryTo: string;
  type: "input" | "output";
  printer_id: number | string;
}

type InsertTransactionStatus = {
  success: boolean;
};

interface PrinterContextProps {
  printers: Printer[];
  selectedPrinter: Printer;
  hasSelectedPrinter: boolean;
  inkStockHistory: InkStockHistory[];

  selectPrinter: (printerId: number) => void;
  removeInk: (inkColor: InkColors, deliveryTo: string) => void;
  insertInk: (inkColor: InkColors) => Promise<InsertTransactionStatus>;
}

interface PrinterContextProviderProps {
  children: ReactNode;
}

export const PrinterContext = createContext({} as PrinterContextProps);

export function PrinterContextProvider({ children }: PrinterContextProviderProps) {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [hasSelectedPrinter, setHasSelectedPrinter] = useState(false);
  const [inkStockHistory, setInkStoryHistory] = useState<InkStockHistory[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer>({} as Printer);

  async function loadPrinters() {
    const response = await api.get<Printer[]>("/printers");
    const printers = response.data;

    setPrinters(printers);
  }

  function selectPrinter(printerId: number) {
    const printer = printers.find((printer) => printer.id === printerId);

    if (!printer) {
      return console.error("PRINTER NOT FOUND");
    }

    setSelectedPrinter(printer);
    setHasSelectedPrinter(true);
  }

  const loadInkStockHistory = useCallback(async () => {
    const response = await api.get<InkStockHistory[]>("/ink-stock-history", {
      params: { printer_id: selectedPrinter.id },
    });

    const inkStockHistory = response.data;

    setInkStoryHistory(inkStockHistory);
  }, [selectedPrinter]);

  async function insertInk(inkColor: InkColors) {
    const updatedInkStock = selectedPrinter.stock.map((state) => {
      if (state.color !== inkColor) return state;

      return {
        ...state,
        amount: state.amount + 1,
      };
    });

    const printer = {
      ...selectedPrinter,
      stock: updatedInkStock,
    };

    const response = await api.put(`/printers/${selectedPrinter.id}`, printer);

    /**
     * O bloco abaixo ser?? executado apenas no backend quando estiver em produ????o
     */
    const stockLog = {
      date: new Date().toISOString(),
      amount: 1,
      color: inkColor,
      deliveryTo: "-",
      type: "input",
      printer_id: selectedPrinter.id,
    };

    await api.post("/ink-stock-history", stockLog);

    if (response.status === 200) {
      setSelectedPrinter(printer);
      loadPrinters();

      return {
        success: true,
      };
    }

    return {
      success: false,
    };
  }

  async function removeInk(inkColor: InkColors, deliveryTo: string) {
    const updatedInkStock = selectedPrinter.stock.map((state) => {
      if (state.color !== inkColor) return state;

      if (state.amount === 0) return state;

      return {
        ...state,
        amount: state.amount - 1,
      };
    });

    const printer = {
      ...selectedPrinter,
      stock: updatedInkStock,
    };

    const response = await api.put(`/printers/${selectedPrinter.id}`, printer);

    const stockLog = {
      deliveryTo,
      type: "output",
      color: inkColor,
      printer_id: selectedPrinter.id,
    };

    await api.post("/ink-stock-history", stockLog);

    if (response.status === 200) {
      setSelectedPrinter(printer);
      loadPrinters();
    }
  }

  useEffect(() => {
    loadPrinters();
  }, []);

  useEffect(() => {
    if (hasSelectedPrinter) {
      loadInkStockHistory();
    }
  }, [hasSelectedPrinter, loadInkStockHistory]);

  return (
    <PrinterContext.Provider
      value={{
        printers,
        selectedPrinter,
        inkStockHistory,
        hasSelectedPrinter,
        insertInk,
        removeInk,
        selectPrinter,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
}
