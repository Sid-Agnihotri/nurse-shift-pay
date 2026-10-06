import type { ShiftPayResult } from "../../pay/types.ts";
import { formatMoney, formatRate } from "../../lib/payFormat.ts";

/** A shift's pay, line by line, like a pay stub: what each line is, where the rule comes from, and the amount. */
export function PayBreakdown({ result, showRates = true }: { result: ShiftPayResult; showRates?: boolean }) {
  return (
    <div className="breakdown">
      <div className="table-wrap">
        <table className="stub">
          <thead>
            <tr>
              <th scope="col">Pay item</th>
              <th scope="col" className="num">Hours</th>
              {showRates && <th scope="col" className="num">Rate</th>}
              <th scope="col" className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((line) => (
              <tr key={`${line.code}-${line.label}`}>
                <td>
                  {line.label}
                  <span className="source">{line.source}</span>
                </td>
                <td className="num">{Number((line.minutes / 60).toFixed(2))}</td>
                {showRates && <td className="num">{formatRate(line.rateCents, line.multiplier)}</td>}
                <td className="num">{formatMoney(line.amountCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={showRates ? 3 : 2}>
                Total before tax
              </th>
              <td className="num">{formatMoney(result.totalCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {result.notes.length > 0 && (
        <ul className="notes">
          {result.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
