import { useCallback, RefObject } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export function usePdfExport(ref: RefObject<HTMLDivElement>) {
  const exportToPdf = useCallback(async (filename: string = "worksheet.pdf") => {
    if (!ref.current) return;

    const element = ref.current;
    
    // A4 dimensions in mm
    const a4Width = 210;
    const a4Height = 297;
    
    const canvas = await html2canvas(element, {
      scale: 4,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = a4Width;
    const imgHeight = (canvas.height * a4Width) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= a4Height;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= a4Height;
    }

    pdf.save(filename);
  }, [ref]);

  return { exportToPdf };
}
