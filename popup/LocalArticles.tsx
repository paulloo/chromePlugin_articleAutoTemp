import { clsx } from "clsx"
import { useEffect, useRef, useState } from "react"

function LocalArticles(props) {
  const [curernt, setCurernt] = useState(-1)
  const [canEdit, setCanEdit] = useState(false)

  function handleClick(item, index) {
    if (curernt === index) {
      return
    }

    setCurernt(index)
    props.onClick(item)
  }

  function handleDelete(item, index) {
    setCurernt(-1)
    props.onDelete(item)
  }

  function handleEdie() {
    setCanEdit(!canEdit)
  }
  return (
    <div className="bg-[#f0f0f0] px-[16px] ">
      <div className=" text-lg font-semibold text-gray-900 dark:text-white flex items-center py-[10px]">
        <div>文章列表: </div>
        <a
          href="javascript:void();"
          class="inline-flex px-2.5 py-1.5 text-xs font-medium text-center text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800"
          onClick={() => handleEdie()}>
          {canEdit ? "取消" : "编辑"}
        </a>
      </div>
      <ul className="max-w-md space-y-1 text-gray-500 list-inside dark:text-gray-400">
        {props.list?.map((item, index) => {
          return (
            <li className="flex justify-between items-center" key={index}>
              <div
                className={clsx(
                  "flex-1 bg-[#F0F0F0] px-[15px] flex items-center cursor-pointer py-[10px] border-b-gray-100",
                  curernt === index ? "text-[#666]" : ""
                )}
                onClick={() => handleClick(item, index)}>
                <svg
                  className="w-3.5 h-3.5 me-2 text-green-500 dark:text-green-400 flex-shrink-0"
                  aria-hidden="true"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  viewBox="0 0 20 20">
                  <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5Zm3.707 8.207-4 4a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L9 10.586l3.293-3.293a1 1 0 0 1 1.414 1.414Z" />
                </svg>
                {item}
              </div>
              {canEdit ? (
                <div
                  onClick={() => handleDelete(item, index)}
                  className="cursor-pointer w-[80px] flex justify-center items-center">
                  <svg
                    className="w-3 h-3"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 14 14">
                    <path
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
                    />
                  </svg>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default LocalArticles
